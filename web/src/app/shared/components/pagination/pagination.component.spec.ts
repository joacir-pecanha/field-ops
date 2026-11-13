import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent (TASK-008 Passo 6)', () => {
  let fixture: ComponentFixture<PaginationComponent>;
  let component: PaginationComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
  });

  it('should display the item range summary and page indicator for populated pages', () => {
    component.page = 0;
    component.size = 20;
    component.totalElements = 45;
    component.totalPages = 3;
    component.first = true;
    component.last = false;
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Exibindo 1–20 de 45 registros');
    expect(text).toContain('Página 1 de 3');
  });

  it('should display empty summary when totalElements is zero', () => {
    component.page = 0;
    component.size = 20;
    component.totalElements = 0;
    component.totalPages = 0;
    component.first = true;
    component.last = true;
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Nenhum registro exibido');
    expect(text).toContain('Página 0 de 0');
  });

  it('should emit pageChange on navigation buttons and respect disabled boundaries', () => {
    const pageSpy = spyOn(component.pageChange, 'emit');
    component.page = 1;
    component.size = 10;
    component.totalElements = 35;
    component.totalPages = 4;
    component.first = false;
    component.last = false;
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.page-btn')
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);

    buttons[0].click(); // Primeira («)
    buttons[1].click(); // Anterior
    buttons[2].click(); // Próxima
    buttons[3].click(); // Última (»)

    expect(pageSpy.calls.allArgs()).toEqual([[0], [0], [2], [3]]);
  });

  it('should prevent navigation when disabled or at boundaries', () => {
    const pageSpy = spyOn(component.pageChange, 'emit');
    component.page = 0;
    component.size = 20;
    component.totalElements = 15;
    component.totalPages = 1;
    component.first = true;
    component.last = true;
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.page-btn')
    ) as HTMLButtonElement[];
    expect(buttons.every((btn) => btn.disabled)).toBeTrue();

    component.goToPage(1);
    component.goToPage(-1);
    expect(pageSpy).not.toHaveBeenCalled();

    component.disabled = true;
    component.totalPages = 3;
    component.goToPage(2);
    expect(pageSpy).not.toHaveBeenCalled();
  });

  it('should emit sizeChange when page size selector changes', () => {
    const sizeSpy = spyOn(component.sizeChange, 'emit');
    component.page = 0;
    component.size = 20;
    component.totalElements = 50;
    component.totalPages = 3;
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('.size-selector select') as HTMLSelectElement;
    select.value = '50';
    select.dispatchEvent(new Event('change'));

    expect(sizeSpy).toHaveBeenCalledWith(50);
  });
});

