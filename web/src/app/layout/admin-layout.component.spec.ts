import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthUser } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { AdminLayoutComponent } from './admin-layout.component';

describe('AdminLayoutComponent', () => {
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let component: AdminLayoutComponent;
  let currentUserSignal: ReturnType<typeof signal<AuthUser | null>>;
  let authServiceMock: jasmine.SpyObj<AuthService>;

  const adminUser: AuthUser = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Joacir Peçanha',
    email: 'admin@fieldops.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    currentUserSignal = signal<AuthUser | null>(adminUser);
    authServiceMock = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], {
      currentUser: currentUserSignal.asReadonly(),
    });
    authServiceMock.logout.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display logged-in user name and role in header (CA-02)', () => {
    const userInfo = fixture.nativeElement.querySelector(
      '[data-testid="header-user-info"]'
    ) as HTMLElement;
    expect(userInfo.textContent).toContain('Joacir Peçanha');
    expect(userInfo.textContent).toContain('Administrador');
  });

  it('should hide ADMIN-only menu items when logged in as SUPERVISOR', () => {
    expect(component.visibleNavItems().some((item) => item.route === '/app/users')).toBeTrue();

    currentUserSignal.set({ ...adminUser, role: 'SUPERVISOR', name: 'Supervisor Ops' });
    fixture.detectChanges();

    expect(component.visibleNavItems().some((item) => item.route === '/app/users')).toBeFalse();
    const userInfo = fixture.nativeElement.querySelector(
      '[data-testid="header-user-info"]'
    ) as HTMLElement;
    expect(userInfo.textContent).toContain('Supervisor');
  });

  it('should render SVG icons for brand mark and navigation items without text tags', () => {
    const brandSvg = fixture.nativeElement.querySelector('.brand-mark svg') as SVGElement | null;
    expect(brandSvg).not.toBeNull();

    const navIcons = fixture.nativeElement.querySelectorAll('.nav-tag svg');
    expect(navIcons.length).toBe(component.visibleNavItems().length);
  });

  it('should call AuthService.logout() when clicking Sair button (RF-05, CA-03)', () => {
    const logoutBtn = fixture.nativeElement.querySelector(
      '[data-testid="logout-button"]'
    ) as HTMLButtonElement;
    logoutBtn.click();

    expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
  });
});

