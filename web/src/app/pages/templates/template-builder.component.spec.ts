import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';
import { TemplateBuilderComponent } from './template-builder.component';
import {
  TemplateApiError,
  TemplateResponse,
  TemplateService,
  TemplateVersionResponse,
} from './template.service';

describe('TemplateBuilderComponent (TASK-010 Passo 6)', () => {
  let fixture: ComponentFixture<TemplateBuilderComponent>;
  let component: TemplateBuilderComponent;
  let templateServiceMock: jasmine.SpyObj<TemplateService>;
  let notificationsMock: jasmine.SpyObj<NotificationService>;
  let router: Router;
  let paramMap$: BehaviorSubject<ParamMap>;

  const draftTemplate: TemplateResponse = {
    id: 'tpl-1',
    code: 'TPL-GER-01',
    title: 'Checklist Preventivo de Gerador',
    description: 'Inspeção mensal',
    category: 'MECANICA',
    status: 'DRAFT',
    active: true,
    version: 1,
    currentVersion: 0,
    activeVersionId: null,
    totalSections: 1,
    totalItems: 2,
    sections: [
      {
        id: 'sec-1',
        templateVersionId: 'ver-1',
        title: 'Segurança',
        description: null,
        orderIndex: 0,
        createdAt: '2026-11-13T10:00:00Z',
        items: [
          {
            id: 'item-1',
            sectionId: 'sec-1',
            code: 'GER-01',
            title: 'Lacre intacto?',
            description: null,
            responseType: 'CONFORMITY',
            required: true,
            observationRequiredOnFailure: true,
            requireObservationOnFail: true,
            evidenceRequiredOnFailure: false,
            requireEvidenceOnFail: false,
            options: [],
            optionsJson: null,
            orderIndex: 0,
            createdAt: '2026-11-13T10:00:00Z',
          },
          {
            id: 'item-2',
            sectionId: 'sec-1',
            code: 'GER-02',
            title: 'Modo de operação',
            description: null,
            responseType: 'SINGLE_CHOICE',
            required: true,
            observationRequiredOnFailure: false,
            requireObservationOnFail: false,
            evidenceRequiredOnFailure: false,
            requireEvidenceOnFail: false,
            options: ['Automático', 'Manual'],
            optionsJson: '["Automático","Manual"]',
            orderIndex: 1,
            createdAt: '2026-11-13T10:00:00Z',
          },
        ],
      },
    ],
    createdBy: 'sup-1',
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
  };

  const draftVersion: TemplateVersionResponse = {
    id: 'ver-1',
    templateId: 'tpl-1',
    version: 1,
    versionNumber: 1,
    status: 'DRAFT',
    titleSnapshot: draftTemplate.title,
    descriptionSnapshot: draftTemplate.description,
    categorySnapshot: draftTemplate.category,
    publishedBy: null,
    publishedAt: null,
    activeForNewInspections: false,
    totalSections: 1,
    totalItems: 2,
    sections: draftTemplate.sections,
    createdAt: '2026-11-13T10:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
  };

  const publishedVersion: TemplateVersionResponse = {
    ...draftVersion,
    status: 'PUBLISHED',
    publishedBy: 'sup-1',
    publishedAt: '2026-11-13T11:00:00Z',
    activeForNewInspections: true,
  };

  const publishedTemplate: TemplateResponse = {
    ...draftTemplate,
    status: 'PUBLISHED',
    currentVersion: 1,
    activeVersionId: 'ver-1',
  };

  beforeEach(async () => {
    paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    templateServiceMock = jasmine.createSpyObj<TemplateService>('TemplateService', [
      'getById',
      'listVersions',
      'createDraft',
      'updateDraft',
      'publish',
      'createNewVersion',
      'activate',
    ]);
    notificationsMock = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'showSuccess',
      'showError',
      'showWarning',
      'showInfo',
    ]);

    templateServiceMock.getById.and.returnValue(of(draftTemplate));
    templateServiceMock.listVersions.and.returnValue(of([draftVersion]));
    templateServiceMock.createDraft.and.returnValue(of(draftTemplate));
    templateServiceMock.updateDraft.and.returnValue(of(draftTemplate));
    templateServiceMock.publish.and.returnValue(of(publishedVersion));
    templateServiceMock.createNewVersion.and.returnValue(
      of({ ...draftVersion, id: 'ver-2', version: 2, versionNumber: 2 })
    );

    await TestBed.configureTestingModule({
      imports: [TemplateBuilderComponent],
      providers: [
        provideRouter([]),
        { provide: TemplateService, useValue: templateServiceMock },
        { provide: NotificationService, useValue: notificationsMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: {} },
            paramMap: paramMap$.asObservable(),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(TemplateBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should add 2 sections with multiple response types, reorder sections/items and save draft (CA-01)', () => {
    const root = fixture.nativeElement as HTMLElement;

    // Estado inicial vazio
    expect(root.querySelector('[data-testid="builder-empty-sections"]')).not.toBeNull();

    // Preencher metadados e adicionar 2 seções via UI
    component.form.patchValue({
      title: 'Inspeção Geral de Subestação',
      category: 'ELETRICA',
      code: 'TPL-SUB-01',
    });

    const addFirstBtn = root.querySelector(
      '[data-testid="add-first-section-btn"]'
    ) as HTMLButtonElement;
    addFirstBtn.click();
    fixture.detectChanges();

    const addSecondBtn = root.querySelector(
      '[data-testid="add-section-btn"]'
    ) as HTMLButtonElement;
    addSecondBtn.click();
    fixture.detectChanges();

    expect(component.sectionsArray.length).toBe(2);
    expect(component.totalSectionsCount()).toBe(2);
    expect(component.totalItemsCount()).toBe(2);

    // Configurar Seção 1 e Item 1.1 (CONFORMITY) + Item 1.2 (SINGLE_CHOICE)
    component.sectionsArray.at(0).controls.title.setValue('Proteção e Aterramento');
    component.itemsArray(0).at(0).patchValue({
      title: 'Conexões sem oxidação?',
      responseType: 'CONFORMITY',
      observationRequiredOnFailure: true,
    });
    component.addItem(0);
    component.itemsArray(0).at(1).patchValue({
      title: 'Seletora do relé',
      responseType: 'SINGLE_CHOICE',
    });
    component.onResponseTypeChange(0, 1);
    component.itemOptionsArray(0, 1).at(0).setValue('Local');
    component.itemOptionsArray(0, 1).at(1).setValue('Remoto');

    // Configurar Seção 2 e Item 2.1 (NUMBER)
    component.sectionsArray.at(1).controls.title.setValue('Medições Térmicas');
    component.itemsArray(1).at(0).patchValue({
      title: 'Temperatura do óleo (°C)',
      responseType: 'NUMBER',
    });
    fixture.detectChanges();

    expect(component.totalItemsCount()).toBe(3);

    // Reordenar Seção 2 para cima
    const moveUpBtns = root.querySelectorAll(
      '[data-testid="move-section-up-btn"]'
    ) as NodeListOf<HTMLButtonElement>;
    moveUpBtns[1].click();
    fixture.detectChanges();

    expect(component.sectionsArray.at(0).controls.title.value).toBe('Medições Térmicas');
    expect(component.sectionsArray.at(0).controls.orderIndex.value).toBe(0);
    expect(component.sectionsArray.at(1).controls.title.value).toBe('Proteção e Aterramento');
    expect(component.sectionsArray.at(1).controls.orderIndex.value).toBe(1);

    // Salvar rascunho
    const saveBtn = root.querySelector('[data-testid="save-draft-btn"]') as HTMLButtonElement;
    saveBtn.click();
    fixture.detectChanges();

    expect(templateServiceMock.createDraft).toHaveBeenCalledTimes(1);
    const sentPayload = templateServiceMock.createDraft.calls.mostRecent().args[0];
    expect(sentPayload.title).toBe('Inspeção Geral de Subestação');
    expect(sentPayload.sections?.length).toBe(2);
    expect(sentPayload.sections?.[1].items?.[1].options).toEqual(['Local', 'Remoto']);
    expect(notificationsMock.showSuccess).toHaveBeenCalled();
  });

  it('should block invalid publish when items are missing or lack responseType/options (RT-03, CA-03)', () => {
    const root = fixture.nativeElement as HTMLElement;

    // Modelo sem seções/itens bloqueia publicação
    const publishBtn = root.querySelector(
      '[data-testid="publish-version-btn"]'
    ) as HTMLButtonElement;
    expect(publishBtn.disabled).toBeTrue();
    expect(root.querySelector('[data-testid="publish-pendencies-banner"]')).not.toBeNull();

    // Adicionar seção com item sem tipo de resposta e item SINGLE_CHOICE sem opções
    component.form.patchValue({ title: 'Modelo Teste', category: 'SEGURANCA' });
    component.addSection(true);
    component.sectionsArray.at(0).controls.title.setValue('Seção 1');
    component.itemsArray(0).at(0).controls.title.setValue('Item sem tipo');
    component.addItem(0);
    component.itemsArray(0).at(1).patchValue({
      title: 'Escolha sem opção',
      responseType: 'SINGLE_CHOICE',
    });
    fixture.detectChanges();

    expect(component.publishPendencies().length).toBe(2);
    expect(publishBtn.disabled).toBeTrue();

    component.openPublishConfirm();
    expect(component.publishConfirmOpen()).toBeFalse();
    expect(templateServiceMock.publish).not.toHaveBeenCalled();

    // Corrigir pendências libera botão Publicar Versão
    component.itemsArray(0).at(0).controls.responseType.setValue('BOOLEAN');
    component.onResponseTypeChange(0, 1);
    component.itemOptionsArray(0, 1).at(0).setValue('Opção A');
    fixture.detectChanges();

    expect(component.publishPendencies()).toEqual([]);
    expect(publishBtn.disabled).toBeFalse();
  });

  it('should keep initial draft editable when backend returns template.version = 0 and v1 DRAFT version', () => {
    templateServiceMock.getById.and.returnValue(of({ ...draftTemplate, version: 0 }));
    templateServiceMock.listVersions.and.returnValue(of([{ ...draftVersion, versionNumber: 1 }]));

    paramMap$.next(convertToParamMap({ templateId: 'tpl-1' }));
    fixture.detectChanges();

    expect(component.viewingHistoricalVersion()).toBeFalse();
    expect(component.isEditable()).toBeTrue();
    expect(component.form.enabled).toBeTrue();
    expect(
      fixture.nativeElement.querySelector('[data-testid="historical-version-banner"]')
    ).toBeNull();
  });

  it('should save pending draft, confirm publish modal and reload published template (RF-05, CA-04)', () => {
    paramMap$.next(convertToParamMap({ templateId: 'tpl-1' }));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(component.isEditable()).toBeTrue();

    // Editar título do item para marcar alteração pendente
    component.itemsArray(0).at(0).controls.title.setValue('Lacre intacto e legível?');
    fixture.detectChanges();
    expect(component.hasUnsavedChanges()).toBeTrue();

    // Clicar em Publicar Versão -> abre modal de confirmação
    const publishBtn = root.querySelector(
      '[data-testid="publish-version-btn"]'
    ) as HTMLButtonElement;
    expect(publishBtn.disabled).toBeFalse();
    publishBtn.click();
    fixture.detectChanges();
    expect(component.publishConfirmOpen()).toBeTrue();

    // Após publicar, próximo loadTemplate retorna modelo PUBLISHED
    templateServiceMock.getById.and.returnValue(of(publishedTemplate));
    templateServiceMock.listVersions.and.returnValue(of([publishedVersion]));

    const modalConfirmBtn = root.querySelector(
      '[data-testid="confirm-modal-confirm-btn"]'
    ) as HTMLButtonElement;
    modalConfirmBtn.click();
    fixture.detectChanges();

    expect(templateServiceMock.updateDraft).toHaveBeenCalledWith(
      'tpl-1',
      jasmine.objectContaining({ title: 'Checklist Preventivo de Gerador' })
    );
    expect(templateServiceMock.publish).toHaveBeenCalledWith('tpl-1');
    expect(notificationsMock.showSuccess).toHaveBeenCalled();
    expect(component.loadedTemplate()?.status).toBe('PUBLISHED');
    expect(component.isEditable()).toBeFalse();
    expect(component.form.disabled).toBeTrue();
    expect(root.querySelector('[data-testid="published-readonly-banner"]')).not.toBeNull();
  });

  it('should display backend publish pendencies on HTTP 400 error', () => {
    paramMap$.next(convertToParamMap({ templateId: 'tpl-1' }));
    fixture.detectChanges();

    templateServiceMock.publish.and.returnValue(
      throwError(
        () =>
          new TemplateApiError(
            'Existem pendências impedindo a publicação.',
            400,
            'TEMPLATE_PUBLISH_BLOCKED',
            {},
            ['Seção 1 possui item inválido no servidor.']
          )
      )
    );

    component.openPublishConfirm();
    component.confirmPublish();
    fixture.detectChanges();

    const errorBanner = fixture.nativeElement.querySelector(
      '[data-testid="builder-form-error"]'
    ) as HTMLElement;
    expect(errorBanner.textContent).toContain('Existem pendências impedindo a publicação.');
    expect(errorBanner.textContent).toContain('Seção 1 possui item inválido no servidor.');
  });

  it('should allow creating a new draft version from a PUBLISHED template (EX-02)', () => {
    templateServiceMock.getById.and.returnValue(of(publishedTemplate));
    templateServiceMock.listVersions.and.returnValue(of([publishedVersion]));
    paramMap$.next(convertToParamMap({ templateId: 'tpl-1' }));
    fixture.detectChanges();

    expect(component.isEditable()).toBeFalse();

    const newVersionBtn = fixture.nativeElement.querySelector(
      '[data-testid="create-new-version-btn"]'
    ) as HTMLButtonElement;
    expect(newVersionBtn).not.toBeNull();

    templateServiceMock.getById.and.returnValue(of({ ...draftTemplate, version: 2 }));
    templateServiceMock.listVersions.and.returnValue(
      of([publishedVersion, { ...draftVersion, id: 'ver-2', version: 2, versionNumber: 2 }])
    );

    newVersionBtn.click();
    fixture.detectChanges();

    expect(templateServiceMock.createNewVersion).toHaveBeenCalledWith('tpl-1');
    expect(component.isEditable()).toBeTrue();
    expect(component.form.enabled).toBeTrue();
  });

  it('should switch to preview tab with live form options and handle dirty navigation guard (RF-04, EX-01)', () => {
    paramMap$.next(convertToParamMap({ templateId: 'tpl-1' }));
    fixture.detectChanges();

    // Alterar dados no formulário antes de salvar
    component.form.controls.title.setValue('Título Modificado em Rascunho');
    fixture.detectChanges();
    expect(component.hasUnsavedChanges()).toBeTrue();

    // Alternar para Prévia do Checklist mantendo alterações vivas (CA-02)
    const previewTabBtn = fixture.nativeElement.querySelector(
      '[data-testid="builder-mode-preview-btn"]'
    ) as HTMLButtonElement;
    previewTabBtn.click();
    fixture.detectChanges();

    const previewEl = fixture.nativeElement.querySelector(
      '[data-testid="template-preview"]'
    ) as HTMLElement;
    expect(previewEl).not.toBeNull();
    expect(previewEl.textContent).toContain('Título Modificado em Rascunho');
    expect(previewEl.textContent).toContain('Automático');
    expect(previewEl.textContent).toContain('Manual');

    // Testar pendingChangesGuard (EX-01)
    let guardResult: boolean | undefined;
    const leave$ = component.confirmLeaveIfDirty();
    expect(typeof leave$).not.toBe('boolean');
    if (typeof leave$ !== 'boolean') {
      leave$.subscribe((allowed) => {
        guardResult = allowed;
      });
    }
    fixture.detectChanges();
    expect(component.discardConfirmOpen()).toBeTrue();

    component.confirmDiscardAndProceed();
    expect(guardResult).toBeTrue();
  });
});
