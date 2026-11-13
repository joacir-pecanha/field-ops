import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { ResponseType } from './template.service';

export type ItemFormGroup = FormGroup<{
  code: FormControl<string>;
  title: FormControl<string>;
  description: FormControl<string>;
  responseType: FormControl<ResponseType | ''>;
  required: FormControl<boolean>;
  observationRequiredOnFailure: FormControl<boolean>;
  evidenceRequiredOnFailure: FormControl<boolean>;
  options: FormArray<FormControl<string>>;
  orderIndex: FormControl<number>;
}>;

export type SectionFormGroup = FormGroup<{
  title: FormControl<string>;
  description: FormControl<string>;
  orderIndex: FormControl<number>;
  items: FormArray<ItemFormGroup>;
}>;
