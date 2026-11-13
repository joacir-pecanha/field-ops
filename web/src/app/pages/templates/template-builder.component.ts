import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, Router, RouterLink } from '@angular/router';
import { Observable, Subject, forkJoin, map, of, switchMap } from 'rxjs';
import { normalizeOptionalText } from '../../core/master/master-data.models';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { applyServerFieldErrors, clearServerError } from '../../shared/utils/form-error.utils';
import { SectionEditorComponent } from './components/section-editor.component';
import {
  PreviewTemplateModel,
  TemplatePreviewComponent,
} from './components/template-preview.component';
import { ItemFormGroup, SectionFormGroup } from './template-form.types';
import {
  RESPONSE_TYPE_OPTIONS,
  ResponseType,
  TEMPLATE_CATEGORY_OPTIONS,
  TemplateApiError,
  TemplateCategoryOption,
  TemplateItemRequest,
  TemplateItemResponse,
  TemplateRequest,
  TemplateResponse,
  TemplateSectionRequest,
  TemplateSectionResponse,
  TemplateService,
  TemplateVersionResponse,
  getResponseTypeMeta,
  getTemplateStatusLabel,
} from './template.service';

export type { ItemFormGroup, SectionFormGroup };

export const pendingChangesGuard: CanDeactivateFn<TemplateBuilderComponent> = (component) => {
  return component.confirmLeaveIfDirty();
};

@Component({
  selector: 'app-template-builder',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ConfirmModalComponent,
    SectionEditorComponent,
    TemplatePreviewComponent,
  ],
  templateUrl: './template-builder.component.html',
  styleUrl: './template-builder.component.scss',
})
export class TemplateBuilderComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly templateService = inject(TemplateService);
  private readonly notifications = inject(NotificationService);

  readonly responseTypeOptions = RESPONSE_TYPE_OPTIONS;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly publishing = signal(false);
  readonly creatingVersion = signal(false);
  readonly reactivating = signal(false);
  readonly submitted = signal(false);

  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly serverPendencies = signal<string[]>([]);

  readonly templateId = signal<string | null>(null);
  readonly loadedTemplate = signal<TemplateResponse | null>(null);
  readonly versions = signal<TemplateVersionResponse[]>([]);
  readonly selectedVersionNumber = signal<number | null>(null);

  readonly publishConfirmOpen = signal(false);
  readonly discardConfirmOpen = signal(false);

  readonly publishPendencies = signal<string[]>([]);
  readonly hasUnsavedChanges = signal(false);
  readonly activeTab = signal<'editor' | 'preview'>('editor');
  readonly totalSectionsCount = signal(0);
  readonly totalItemsCount = signal(0);
  readonly previewModel = signal<PreviewTemplateModel>({
    code: null,
    title: '',
    category: '',
    description: null,
    versionLabel: 'Novo Rascunho',
    statusLabel: 'Rascunho',
    sections: [],
  });

  readonly selectedSectionGroup = signal<SectionFormGroup | null>(null);
  readonly selectedItemGroup = signal<ItemFormGroup | null>(null);
  private readonly collapsedSections = signal<Set<SectionFormGroup>>(new Set());

  private savedSnapshot = '';
  private discardSubject: Subject<boolean> | null = null;
  private domCounter = 0;
  private readonly sectionDomIds = new WeakMap<SectionFormGroup, string>();
  private readonly itemDomIds = new WeakMap<ItemFormGroup, string>();

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z0-9_-]*$/)]],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    category: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(1000)]],
    sections: this.fb.array<SectionFormGroup>([]),
  });

  readonly selectedVersion = computed(() => {
    const versionNumber = this.selectedVersionNumber();
    if (versionNumber === null) {
      return null;
    }
    return this.versions().find((v) => v.versionNumber === versionNumber) ?? null;
  });

  readonly latestDraftVersion = computed(() => {
    const drafts = this.versions().filter((v) => v.status === 'DRAFT');
    return drafts.length > 0 ? drafts[drafts.length - 1] : null;
  });

  readonly viewingHistoricalVersion = computed(() => {
    const template = this.loadedTemplate();
    const version = this.selectedVersion();
    if (!template || !version) {
      return false;
    }
    if (template.status === 'DRAFT') {
      const latestDraft = this.latestDraftVersion();
      if (latestDraft) {
        return version.status !== 'DRAFT' || version.versionNumber !== latestDraft.versionNumber;
      }
      return version.status !== 'DRAFT';
    }
    return version.versionNumber !== template.currentVersion;
  });

  readonly isEditable = computed(() => {
    const template = this.loadedTemplate();
    if (!template) {
      return true;
    }
    return template.status === 'DRAFT' && !this.viewingHistoricalVersion();
  });

  readonly availableCategories = computed<readonly TemplateCategoryOption[]>(() => {
    const current = this.loadedTemplate()?.category || this.selectedVersion()?.categorySnapshot;
    if (!current) {
      return TEMPLATE_CATEGORY_OPTIONS;
    }
    const exists = TEMPLATE_CATEGORY_OPTIONS.some(
      (opt) => opt.value.toUpperCase() === current.trim().toUpperCase()
    );
    if (exists) {
      return TEMPLATE_CATEGORY_OPTIONS;
    }
    return [...TEMPLATE_CATEGORY_OPTIONS, { value: current, label: current }];
  });

  ngOnInit(): void {
    if (this.route.snapshot.data?.['initialTab'] === 'preview') {
      this.activeTab.set('preview');
    }

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.recomputeReactiveState();
    });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('templateId');
      this.templateId.set(id);
      if (id) {
        this.loadTemplate(id);
      } else {
        this.initNewTemplate();
      }
    });
  }

  setActiveTab(tab: 'editor' | 'preview'): void {
    if (tab === 'preview') {
      this.previewModel.set(this.buildPreviewModel());
    }
    this.activeTab.set(tab);
  }

  onSectionStructureChanged(): void {
    this.recomputeReactiveState();
  }

  ngOnDestroy(): void {
    this.resolveDiscardPrompt(false);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  confirmLeaveIfDirty(): boolean | Observable<boolean> {
    if (!this.hasUnsavedChanges()) {
      return true;
    }
    return this.openDiscardPrompt();
  }

  get sectionsArray(): FormArray<SectionFormGroup> {
    return this.form.controls.sections;
  }

  itemsArray(sectionIndex: number): FormArray<ItemFormGroup> {
    return this.sectionsArray.at(sectionIndex).controls.items;
  }

  itemOptionsArray(sectionIndex: number, itemIndex: number): FormArray<FormControl<string>> {
    return this.itemsArray(sectionIndex).at(itemIndex).controls.options;
  }

  loadTemplate(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.formError.set(null);
    this.serverPendencies.set([]);
    this.submitted.set(false);

    forkJoin({
      template: this.templateService.getById(id),
      versions: this.templateService.listVersions(id),
    }).subscribe({
      next: ({ template, versions }) => {
        this.loadedTemplate.set(template);
        this.versions.set(versions);

        const defaultVersionNumber =
          template.status === 'DRAFT'
            ? versions.find((v) => v.status === 'DRAFT')?.versionNumber ?? template.version
            : template.currentVersion || versions[versions.length - 1]?.versionNumber || null;
        this.selectedVersionNumber.set(defaultVersionNumber);

        this.populateFormFromSections(
          template.code,
          template.title,
          template.category,
          template.description,
          template.sections
        );
        this.syncFormAvailability();
        this.markSnapshotClean();
        this.loading.set(false);
      },
      error: (err: unknown) => {
        const message =
          err instanceof TemplateApiError
            ? err.message
            : 'Não foi possível carregar o modelo de inspeção.';
        this.loadError.set(message);
        this.loading.set(false);
      },
    });
  }

  selectVersion(version: TemplateVersionResponse): void {
    if (version.versionNumber === this.selectedVersionNumber()) {
      return;
    }

    const applyVersion = () => {
      this.selectedVersionNumber.set(version.versionNumber);
      const template = this.loadedTemplate();
      this.populateFormFromSections(
        template?.code ?? null,
        version.titleSnapshot,
        version.categorySnapshot,
        version.descriptionSnapshot,
        version.sections
      );
      this.syncFormAvailability();
      this.markSnapshotClean();
    };

    if (!this.hasUnsavedChanges()) {
      applyVersion();
      return;
    }

    this.openDiscardPrompt().subscribe((confirmed) => {
      if (confirmed) {
        applyVersion();
      }
    });
  }

  returnToDraftVersion(): void {
    const draft = this.latestDraftVersion();
    if (draft) {
      this.selectVersion(draft);
    }
  }

  addSection(withInitialItem = false): void {
    if (!this.isEditable()) {
      return;
    }

    const section = this.createSectionGroup();
    if (withInitialItem) {
      section.controls.items.push(this.createItemGroup());
    }
    this.sectionsArray.push(section);
    this.syncOrderIndexes();
    this.selectedSectionGroup.set(section);
    this.selectedItemGroup.set(
      section.controls.items.length > 0 ? section.controls.items.at(0) : null
    );
    this.recomputeReactiveState();
    this.scrollIntoView(this.getSectionDomId(section));
  }

  duplicateSection(sectionIndex: number): void {
    if (!this.isEditable()) {
      return;
    }

    const source = this.sectionsArray.at(sectionIndex).getRawValue();
    const cloned = this.createSectionGroup({
      title: source.title.trim() ? `${source.title.trim()} (Cópia)` : '',
      description: source.description,
    });

    for (const item of source.items) {
      cloned.controls.items.push(
        this.createItemGroup({
          code: item.code ? `${item.code}-CP` : '',
          title: item.title,
          description: item.description,
          responseType: item.responseType || null,
          required: item.required,
          observationRequiredOnFailure: item.observationRequiredOnFailure,
          evidenceRequiredOnFailure: item.evidenceRequiredOnFailure,
          options: item.options,
        })
      );
    }

    this.sectionsArray.insert(sectionIndex + 1, cloned);
    this.syncOrderIndexes();
    this.selectedSectionGroup.set(cloned);
    this.selectedItemGroup.set(null);
    this.recomputeReactiveState();
  }

  moveSection(sectionIndex: number, delta: -1 | 1): void {
    if (!this.isEditable()) {
      return;
    }
    const targetIndex = sectionIndex + delta;
    if (targetIndex < 0 || targetIndex >= this.sectionsArray.length) {
      return;
    }

    const section = this.sectionsArray.at(sectionIndex);
    this.sectionsArray.removeAt(sectionIndex, { emitEvent: false });
    this.sectionsArray.insert(targetIndex, section, { emitEvent: false });
    this.syncOrderIndexes();
    this.selectedSectionGroup.set(section);
    this.recomputeReactiveState();
  }

  removeSection(sectionIndex: number): void {
    if (!this.isEditable()) {
      return;
    }

    const removed = this.sectionsArray.at(sectionIndex);
    this.sectionsArray.removeAt(sectionIndex);
    this.collapsedSections.update((set) => {
      const next = new Set(set);
      next.delete(removed);
      return next;
    });

    if (this.selectedSectionGroup() === removed) {
      this.selectedSectionGroup.set(null);
      this.selectedItemGroup.set(null);
    }

    this.syncOrderIndexes();
    this.recomputeReactiveState();
  }

  toggleSectionCollapse(sectionIndex: number): void {
    const section = this.sectionsArray.at(sectionIndex);
    this.collapsedSections.update((set) => {
      const next = new Set(set);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  isSectionCollapsed(sectionIndex: number): boolean {
    const section = this.sectionsArray.at(sectionIndex);
    return this.collapsedSections().has(section);
  }

  addItem(sectionIndex: number): void {
    if (!this.isEditable()) {
      return;
    }

    const section = this.sectionsArray.at(sectionIndex);
    this.expandSection(section);
    const item = this.createItemGroup();
    section.controls.items.push(item);
    this.syncOrderIndexes();
    this.selectedSectionGroup.set(section);
    this.selectedItemGroup.set(item);
    this.recomputeReactiveState();
    this.scrollIntoView(this.getItemDomId(item));
  }

  duplicateItem(sectionIndex: number, itemIndex: number): void {
    if (!this.isEditable()) {
      return;
    }

    const items = this.itemsArray(sectionIndex);
    const source = items.at(itemIndex).getRawValue();
    const cloned = this.createItemGroup({
      code: source.code ? `${source.code}-CP` : '',
      title: source.title.trim() ? `${source.title.trim()} (Cópia)` : '',
      description: source.description,
      responseType: source.responseType || null,
      required: source.required,
      observationRequiredOnFailure: source.observationRequiredOnFailure,
      evidenceRequiredOnFailure: source.evidenceRequiredOnFailure,
      options: source.options,
    });

    items.insert(itemIndex + 1, cloned);
    this.syncOrderIndexes();
    this.selectedSectionGroup.set(this.sectionsArray.at(sectionIndex));
    this.selectedItemGroup.set(cloned);
    this.recomputeReactiveState();
  }

  moveItem(sectionIndex: number, itemIndex: number, delta: -1 | 1): void {
    if (!this.isEditable()) {
      return;
    }
    const items = this.itemsArray(sectionIndex);
    const targetIndex = itemIndex + delta;
    if (targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    const item = items.at(itemIndex);
    items.removeAt(itemIndex, { emitEvent: false });
    items.insert(targetIndex, item, { emitEvent: false });
    this.syncOrderIndexes();
    this.selectedSectionGroup.set(this.sectionsArray.at(sectionIndex));
    this.selectedItemGroup.set(item);
    this.recomputeReactiveState();
  }

  removeItem(sectionIndex: number, itemIndex: number): void {
    if (!this.isEditable()) {
      return;
    }
    const items = this.itemsArray(sectionIndex);
    const removed = items.at(itemIndex);
    items.removeAt(itemIndex);
    if (this.selectedItemGroup() === removed) {
      this.selectedItemGroup.set(null);
    }
    this.syncOrderIndexes();
    this.recomputeReactiveState();
  }

  onResponseTypeChange(sectionIndex: number, itemIndex: number): void {
    const item = this.itemsArray(sectionIndex).at(itemIndex);
    if (item.controls.responseType.value === 'SINGLE_CHOICE' && item.controls.options.length === 0) {
      item.controls.options.push(this.fb.nonNullable.control(''));
      item.controls.options.push(this.fb.nonNullable.control(''));
    }
    this.recomputeReactiveState();
  }

  addOption(sectionIndex: number, itemIndex: number): void {
    if (!this.isEditable()) {
      return;
    }
    this.itemOptionsArray(sectionIndex, itemIndex).push(this.fb.nonNullable.control(''));
    this.recomputeReactiveState();
  }

  removeOption(sectionIndex: number, itemIndex: number, optionIndex: number): void {
    if (!this.isEditable()) {
      return;
    }
    this.itemOptionsArray(sectionIndex, itemIndex).removeAt(optionIndex);
    this.recomputeReactiveState();
  }

  moveOption(sectionIndex: number, itemIndex: number, optionIndex: number, delta: -1 | 1): void {
    if (!this.isEditable()) {
      return;
    }
    const options = this.itemOptionsArray(sectionIndex, itemIndex);
    const target = optionIndex + delta;
    if (target < 0 || target >= options.length) {
      return;
    }
    const control = options.at(optionIndex);
    options.removeAt(optionIndex, { emitEvent: false });
    options.insert(target, control, { emitEvent: false });
    this.recomputeReactiveState();
  }

  focusSection(sectionIndex: number): void {
    const section = this.sectionsArray.at(sectionIndex);
    this.expandSection(section);
    this.selectedSectionGroup.set(section);
    this.selectedItemGroup.set(null);
    this.scrollIntoView(this.getSectionDomId(section));
  }

  focusItem(sectionIndex: number, itemIndex: number): void {
    const section = this.sectionsArray.at(sectionIndex);
    this.expandSection(section);
    const item = section.controls.items.at(itemIndex);
    this.selectedSectionGroup.set(section);
    this.selectedItemGroup.set(item);
    this.scrollIntoView(this.getItemDomId(item));
  }

  getSectionDomId(section: SectionFormGroup): string {
    let id = this.sectionDomIds.get(section);
    if (!id) {
      this.domCounter += 1;
      id = `builder-section-${this.domCounter}`;
      this.sectionDomIds.set(section, id);
    }
    return id;
  }

  readonly getItemDomIdFn = (item: ItemFormGroup): string => this.getItemDomId(item);

  getItemDomId(item: ItemFormGroup): string {
    let id = this.itemDomIds.get(item);
    if (!id) {
      this.domCounter += 1;
      id = `builder-item-${this.domCounter}`;
      this.itemDomIds.set(item, id);
    }
    return id;
  }

  onHeaderFieldInput(controlName: 'code' | 'title' | 'category' | 'description'): void {
    clearServerError(this.form, controlName);
  }

  isHeaderInvalid(controlName: 'code' | 'title' | 'category' | 'description'): boolean {
    const control = this.form.controls[controlName];
    return Boolean(control.invalid && (control.dirty || control.touched || this.submitted()));
  }

  isSectionTitleInvalid(sectionIndex: number): boolean {
    const control = this.sectionsArray.at(sectionIndex).controls.title;
    return Boolean(control.invalid && (control.dirty || control.touched || this.submitted()));
  }

  isItemTitleInvalid(sectionIndex: number, itemIndex: number): boolean {
    const control = this.itemsArray(sectionIndex).at(itemIndex).controls.title;
    return Boolean(control.invalid && (control.dirty || control.touched || this.submitted()));
  }

  getItemIssues(sectionIndex: number, itemIndex: number): string[] {
    const item = this.itemsArray(sectionIndex).at(itemIndex).getRawValue();
    const issues: string[] = [];
    if (!item.title.trim()) {
      issues.push('Título obrigatório');
    }
    if (!item.responseType) {
      issues.push('Sem tipo de resposta');
    } else if (
      item.responseType === 'SINGLE_CHOICE' &&
      !item.options.some((opt) => opt.trim().length > 0)
    ) {
      issues.push('Sem opções válidas');
    }
    return issues;
  }

  getSectionIssuesCount(sectionIndex: number): number {
    const section = this.sectionsArray.at(sectionIndex).getRawValue();
    let count = 0;
    if (!section.title.trim()) {
      count += 1;
    }
    if (section.items.length === 0) {
      count += 1;
    }
    for (let i = 0; i < section.items.length; i += 1) {
      count += this.getItemIssues(sectionIndex, i).length;
    }
    return count;
  }

  responseTypeBadge(type: ResponseType | '' | null | undefined): string {
    return getResponseTypeMeta(type || null)?.badge ?? 'SEM TIPO';
  }

  statusLabel(status: TemplateResponse['status'] | TemplateVersionResponse['status']): string {
    return getTemplateStatusLabel(status);
  }

  saveDraft(): void {
    if (!this.isEditable() || this.saving() || this.publishing()) {
      return;
    }

    this.submitted.set(true);
    this.formError.set(null);
    this.serverPendencies.set([]);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.expandSectionsWithInvalidControls();
      this.formError.set(
        'Revise os campos obrigatórios destacados antes de salvar o rascunho.'
      );
      return;
    }

    const payload = this.buildPayload();
    const currentId = this.templateId();
    this.saving.set(true);

    const request$ = currentId
      ? this.templateService.updateDraft(currentId, payload)
      : this.templateService.createDraft(payload);

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.submitted.set(false);
        this.loadedTemplate.set(saved);
        this.templateId.set(saved.id);
        this.populateFormFromSections(
          saved.code,
          saved.title,
          saved.category,
          saved.description,
          saved.sections
        );
        this.syncFormAvailability();
        this.markSnapshotClean();
        this.notifications.showSuccess(
          currentId
            ? `Rascunho "${saved.title}" salvo com sucesso.`
            : `Modelo "${saved.title}" criado em rascunho.`
        );

        this.templateService.listVersions(saved.id).subscribe({
          next: (versions) => {
            this.versions.set(versions);
            const draft = versions.find((v) => v.status === 'DRAFT');
            if (draft) {
              this.selectedVersionNumber.set(draft.versionNumber);
            }
          },
        });

        if (!currentId) {
          void this.router.navigate(['/app/inspection-templates', saved.id, 'edit'], {
            replaceUrl: true,
          });
        }
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.handleApiSaveError(err, 'Não foi possível salvar o rascunho do modelo.');
      },
    });
  }

  openPublishConfirm(): void {
    if (
      !this.isEditable() ||
      this.publishPendencies().length > 0 ||
      this.saving() ||
      this.publishing()
    ) {
      return;
    }

    this.submitted.set(true);
    this.formError.set(null);
    this.serverPendencies.set([]);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.expandSectionsWithInvalidControls();
      this.formError.set(
        'Revise os campos obrigatórios destacados antes de publicar o modelo.'
      );
      return;
    }

    this.publishConfirmOpen.set(true);
  }

  cancelPublishConfirm(): void {
    if (this.publishing()) {
      return;
    }
    this.publishConfirmOpen.set(false);
  }

  confirmPublish(): void {
    if (this.publishing() || !this.isEditable()) {
      return;
    }

    this.publishing.set(true);
    this.formError.set(null);
    this.serverPendencies.set([]);

    const currentId = this.templateId();
    const payload = this.buildPayload();

    const ensureSaved$: Observable<string> = !currentId
      ? this.templateService.createDraft(payload).pipe(map((saved) => saved.id))
      : this.hasUnsavedChanges()
        ? this.templateService.updateDraft(currentId, payload).pipe(map((saved) => saved.id))
        : of(currentId);

    ensureSaved$
      .pipe(
        switchMap((savedId) =>
          this.templateService.publish(savedId).pipe(
            map((publishedVersion) => ({ savedId, publishedVersion }))
          )
        )
      )
      .subscribe({
        next: ({ savedId, publishedVersion }) => {
          this.publishing.set(false);
          this.publishConfirmOpen.set(false);
          this.markSnapshotClean();
          this.notifications.showSuccess(
            `Versão v${publishedVersion.versionNumber} de "${publishedVersion.titleSnapshot}" publicada com sucesso!`
          );

          if (!currentId) {
            void this.router.navigate(['/app/inspection-templates', savedId, 'edit'], {
              replaceUrl: true,
            });
          } else {
            this.loadTemplate(savedId);
          }
        },
        error: (err: unknown) => {
          this.publishing.set(false);
          this.publishConfirmOpen.set(false);
          this.handleApiSaveError(err, 'Não foi possível publicar a versão do modelo.');
        },
      });
  }

  createNewVersion(): void {
    const id = this.templateId();
    if (!id || this.creatingVersion() || this.loading()) {
      return;
    }

    this.creatingVersion.set(true);
    this.formError.set(null);
    this.templateService.createNewVersion(id).subscribe({
      next: (created) => {
        this.creatingVersion.set(false);
        this.notifications.showSuccess(
          `Nova versão v${created.versionNumber} criada em rascunho para edição.`
        );
        this.loadTemplate(id);
      },
      error: (err: unknown) => {
        this.creatingVersion.set(false);
        const message =
          err instanceof TemplateApiError
            ? err.message
            : 'Não foi possível criar uma nova versão do modelo.';
        this.formError.set(message);
        this.notifications.showError(message);
      },
    });
  }

  reactivateTemplate(): void {
    const id = this.templateId();
    if (!id || this.reactivating() || this.loading()) {
      return;
    }

    this.reactivating.set(true);
    this.templateService.activate(id).subscribe({
      next: (saved) => {
        this.reactivating.set(false);
        this.notifications.showSuccess(`Modelo "${saved.title}" reativado com sucesso.`);
        this.loadTemplate(id);
      },
      error: (err: unknown) => {
        this.reactivating.set(false);
        const message =
          err instanceof TemplateApiError ? err.message : 'Não foi possível reativar o modelo.';
        this.formError.set(message);
      },
    });
  }

  confirmDiscardAndProceed(): void {
    this.resolveDiscardPrompt(true);
  }

  cancelDiscardPrompt(): void {
    this.resolveDiscardPrompt(false);
  }

  private initNewTemplate(): void {
    this.loadedTemplate.set(null);
    this.versions.set([]);
    this.selectedVersionNumber.set(null);
    this.populateFormFromSections(null, '', '', null, []);
    this.syncFormAvailability();
    this.markSnapshotClean();
  }

  private populateFormFromSections(
    code: string | null,
    title: string,
    category: string,
    description: string | null,
    sections: TemplateSectionResponse[]
  ): void {
    this.sectionsArray.clear({ emitEvent: false });
    this.collapsedSections.set(new Set());
    this.selectedSectionGroup.set(null);
    this.selectedItemGroup.set(null);

    const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
    for (const sec of sortedSections) {
      const sectionGroup = this.createSectionGroup(sec);
      const sortedItems = [...sec.items].sort((a, b) => a.orderIndex - b.orderIndex);
      for (const item of sortedItems) {
        sectionGroup.controls.items.push(this.createItemGroup(item));
      }
      this.sectionsArray.push(sectionGroup, { emitEvent: false });
    }

    this.form.patchValue(
      {
        code: code ?? '',
        title: title ?? '',
        category: category ?? '',
        description: description ?? '',
      },
      { emitEvent: false }
    );
    this.syncOrderIndexes();
    this.recomputeReactiveState();
  }

  private createSectionGroup(section?: Partial<TemplateSectionResponse>): SectionFormGroup {
    return this.fb.nonNullable.group({
      title: [section?.title ?? '', [Validators.required, Validators.maxLength(200)]],
      description: [section?.description ?? '', [Validators.maxLength(500)]],
      orderIndex: [section?.orderIndex ?? 0],
      items: this.fb.array<ItemFormGroup>([]),
    });
  }

  private createItemGroup(item?: Partial<TemplateItemResponse>): ItemFormGroup {
    const initialOptions =
      item?.options && item.options.length > 0
        ? item.options.map((opt) => this.fb.nonNullable.control(opt))
        : [];

    return this.fb.nonNullable.group({
      code: [item?.code ?? '', [Validators.maxLength(60)]],
      title: [item?.title ?? '', [Validators.required, Validators.maxLength(300)]],
      description: [item?.description ?? '', [Validators.maxLength(1000)]],
      responseType: this.fb.nonNullable.control<ResponseType | ''>(item?.responseType ?? ''),
      required: [item?.required ?? true],
      observationRequiredOnFailure: [
        item?.observationRequiredOnFailure ?? item?.requireObservationOnFail ?? false,
      ],
      evidenceRequiredOnFailure: [
        item?.evidenceRequiredOnFailure ?? item?.requireEvidenceOnFail ?? false,
      ],
      options: this.fb.array<FormControl<string>>(initialOptions),
      orderIndex: [item?.orderIndex ?? 0],
    });
  }

  private syncFormAvailability(): void {
    if (this.isEditable()) {
      this.form.enable({ emitEvent: false });
    } else {
      this.form.disable({ emitEvent: false });
    }
  }

  private syncOrderIndexes(): void {
    this.sectionsArray.controls.forEach((sectionGroup, sIdx) => {
      sectionGroup.controls.orderIndex.setValue(sIdx, { emitEvent: false });
      sectionGroup.controls.items.controls.forEach((itemGroup, iIdx) => {
        itemGroup.controls.orderIndex.setValue(iIdx, { emitEvent: false });
      });
    });
  }

  private recomputeReactiveState(): void {
    this.totalSectionsCount.set(this.sectionsArray.length);
    this.totalItemsCount.set(
      this.sectionsArray.controls.reduce((sum, sec) => sum + sec.controls.items.length, 0)
    );
    this.publishPendencies.set(this.computePublishPendencies());
    this.previewModel.set(this.buildPreviewModel());

    if (!this.isEditable()) {
      this.hasUnsavedChanges.set(false);
      return;
    }
    this.hasUnsavedChanges.set(
      this.savedSnapshot !== '' && this.serializeFormSnapshot() !== this.savedSnapshot
    );
  }

  private buildPreviewModel(): PreviewTemplateModel {
    const raw = this.form.getRawValue();
    const tpl = this.loadedTemplate();
    const selectedVersion = this.selectedVersion();
    const versionNumber = selectedVersion?.versionNumber ?? tpl?.version ?? 1;
    const status = selectedVersion?.status ?? tpl?.status ?? 'DRAFT';

    return {
      code: normalizeOptionalText(raw.code),
      title: raw.title,
      category: raw.category,
      description: normalizeOptionalText(raw.description),
      versionLabel: tpl ? `v${versionNumber}` : 'Novo Rascunho',
      statusLabel: getTemplateStatusLabel(status),
      sections: raw.sections.map((section) => ({
        title: section.title,
        description: normalizeOptionalText(section.description),
        items: section.items.map((item) => ({
          code: normalizeOptionalText(item.code),
          title: item.title,
          description: normalizeOptionalText(item.description),
          responseType: item.responseType,
          required: item.required,
          observationRequiredOnFailure: item.observationRequiredOnFailure,
          evidenceRequiredOnFailure: item.evidenceRequiredOnFailure,
          options: [...item.options],
        })),
      })),
    };
  }

  private markSnapshotClean(): void {
    this.savedSnapshot = this.serializeFormSnapshot();
    this.form.markAsPristine();
    this.recomputeReactiveState();
  }

  private serializeFormSnapshot(): string {
    return JSON.stringify(this.form.getRawValue());
  }

  private computePublishPendencies(): string[] {
    const raw = this.form.getRawValue();
    const pendencies: string[] = [];

    if (!raw.title.trim()) {
      pendencies.push('O modelo deve possuir um título válido antes da publicação.');
    }
    if (!raw.category.trim()) {
      pendencies.push('O modelo deve possuir uma categoria operacional selecionada.');
    }

    if (raw.sections.length === 0) {
      pendencies.push('Adicione ao menos uma seção com um item válido antes de publicar.');
      return pendencies;
    }

    let totalItems = 0;
    raw.sections.forEach((section, sIdx) => {
      const sectionLabel = section.title.trim() || `Seção #${sIdx + 1}`;
      if (!section.title.trim()) {
        pendencies.push(`A seção #${sIdx + 1} deve possuir um título.`);
      }

      if (section.items.length === 0) {
        pendencies.push(`A seção "${sectionLabel}" não possui itens cadastrados.`);
        return;
      }

      section.items.forEach((item, iIdx) => {
        totalItems += 1;
        const itemLabel = item.title.trim() || `Item #${iIdx + 1}`;
        if (!item.title.trim()) {
          pendencies.push(`O item #${iIdx + 1} da seção "${sectionLabel}" deve possuir título.`);
        }
        if (!item.responseType) {
          pendencies.push(
            `O item "${itemLabel}" da seção "${sectionLabel}" não possui tipo de resposta definido.`
          );
        } else if (item.responseType === 'SINGLE_CHOICE') {
          const hasValidOption = item.options.some((opt) => opt.trim().length > 0);
          if (!hasValidOption) {
            pendencies.push(
              `O item "${itemLabel}" (Escolha Única) da seção "${sectionLabel}" deve possuir ao menos uma opção preenchida.`
            );
          }
        }
      });
    });

    if (totalItems === 0) {
      pendencies.push('O modelo deve possuir ao menos um item válido antes de publicar.');
    }

    return pendencies;
  }

  private buildPayload(): TemplateRequest {
    this.syncOrderIndexes();
    const raw = this.form.getRawValue();

    const sections: TemplateSectionRequest[] = raw.sections.map((section, sIdx) => {
      const items: TemplateItemRequest[] = section.items.map((item, iIdx) => {
        const sanitizedOptions =
          item.responseType === 'SINGLE_CHOICE'
            ? item.options.map((opt) => opt.trim()).filter((opt) => opt.length > 0)
            : [];

        return {
          code: normalizeOptionalText(item.code),
          title: item.title.trim(),
          description: normalizeOptionalText(item.description),
          responseType: item.responseType ? item.responseType : null,
          required: item.required,
          observationRequiredOnFailure: item.observationRequiredOnFailure,
          evidenceRequiredOnFailure: item.evidenceRequiredOnFailure,
          options: item.responseType === 'SINGLE_CHOICE' ? sanitizedOptions : null,
          orderIndex: iIdx,
        };
      });

      return {
        title: section.title.trim(),
        description: normalizeOptionalText(section.description),
        orderIndex: sIdx,
        items,
      };
    });

    return {
      code: normalizeOptionalText(raw.code),
      title: raw.title.trim(),
      description: normalizeOptionalText(raw.description),
      category: raw.category.trim(),
      sections,
    };
  }

  private handleApiSaveError(err: unknown, fallbackMessage: string): void {
    if (err instanceof TemplateApiError) {
      this.formError.set(err.message);
      if (err.pendencies.length > 0) {
        this.serverPendencies.set(err.pendencies);
      }
      applyServerFieldErrors(this.form, err, { DUPLICATE_TEMPLATE_CODE: 'code' });
      return;
    }
    this.formError.set(fallbackMessage);
  }

  private expandSection(section: SectionFormGroup): void {
    if (!this.collapsedSections().has(section)) {
      return;
    }
    this.collapsedSections.update((set) => {
      const next = new Set(set);
      next.delete(section);
      return next;
    });
  }

  private expandSectionsWithInvalidControls(): void {
    this.sectionsArray.controls.forEach((sectionGroup) => {
      if (sectionGroup.invalid) {
        this.expandSection(sectionGroup);
      }
    });
  }

  private scrollIntoView(elementId: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  private openDiscardPrompt(): Observable<boolean> {
    this.resolveDiscardPrompt(false);
    this.discardSubject = new Subject<boolean>();
    this.discardConfirmOpen.set(true);
    return this.discardSubject.asObservable();
  }

  private resolveDiscardPrompt(result: boolean): void {
    this.discardConfirmOpen.set(false);
    if (this.discardSubject) {
      const subject = this.discardSubject;
      this.discardSubject = null;
      subject.next(result);
      subject.complete();
    }
  }
}
