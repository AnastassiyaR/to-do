import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { Todo } from './todo.service';

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let root: HTMLElement;
  let http: HttpTestingController;

  const input = () => root.querySelector<HTMLInputElement>('.input input')!;
  const addButton = () => root.querySelector<HTMLButtonElement>('.button-add')!;
  const texts = (section: string) =>
    Array.from(root.querySelectorAll(`.${section} .task span`)).map((el) => el.textContent);
  const emptyMessage = (section: string) =>
    root.querySelector(`.${section} .empty`)?.textContent?.trim();

  /** Creates the component and answers the initial GET /api/todos */
  function start(initial: Todo[] = []): void {
    fixture = TestBed.createComponent(App);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne({ method: 'GET', url: '/api/todos' }).flush(initial);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should create the app and show the title', () => {
    start();
    expect(fixture.componentInstance).toBeTruthy();
    expect(root.querySelector('h1')?.textContent).toContain('To-do list');
  });

  it('should show empty messages and no DELETE ALL button when there are no tasks', () => {
    start();
    expect(emptyMessage('activetasks')).toBe('No active tasks.');
    expect(emptyMessage('completedtasks')).toBe('No completed tasks.');
    expect(root.querySelector('.deletedbutton')).toBeNull();
  });

  it('should load tasks from the API and split them by status', () => {
    start([
      { id: '1', desc: 'one', status: 'act' },
      { id: '2', desc: 'two', status: 'inv' },
      { id: '3', desc: 'three', status: 'act' },
    ]);
    expect(texts('activetasks')).toEqual(['one', 'three']);
    expect(texts('completedtasks')).toEqual(['two']);
  });

  it('should show an error when loading fails', () => {
    fixture = TestBed.createComponent(App);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne('/api/todos').flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(root.querySelector('.error')?.textContent).toContain('Could not load tasks');
  });

  it('should POST a trimmed task, show it and clear the input', () => {
    start();
    input().value = '  buy milk  ';
    addButton().click();

    const req = http.expectOne({ method: 'POST', url: '/api/todos' });
    expect(req.request.body).toEqual({ desc: 'buy milk' });
    req.flush({ id: '1', desc: 'buy milk', status: 'act' });
    fixture.detectChanges();

    expect(texts('activetasks')).toEqual(['buy milk']);
    expect(input().value).toBe('');
  });

  it('should not call the API for empty or whitespace-only tasks', () => {
    start();
    input().value = '   ';
    addButton().click();
    input().value = '';
    addButton().click();
    http.expectNone('/api/todos');
  });

  it('should add a task when Enter is pressed', () => {
    start();
    input().value = 'press enter';
    input().dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

    http.expectOne({ method: 'POST', url: '/api/todos' }).flush({ id: '1', desc: 'press enter', status: 'act' });
    fixture.detectChanges();
    expect(texts('activetasks')).toEqual(['press enter']);
  });

  it('should PATCH the status and move a task to completed and back', () => {
    start([
      { id: '1', desc: 'one', status: 'act' },
      { id: '2', desc: 'two', status: 'act' },
    ]);

    root.querySelectorAll<HTMLInputElement>('.activetasks .task input')[0].click();
    const toDone = http.expectOne({ method: 'PATCH', url: '/api/todos/1' });
    expect(toDone.request.body).toEqual({ status: 'inv' });
    toDone.flush({ id: '1', desc: 'one', status: 'inv' });
    fixture.detectChanges();
    expect(texts('activetasks')).toEqual(['two']);
    expect(texts('completedtasks')).toEqual(['one']);

    root.querySelectorAll<HTMLInputElement>('.completedtasks .task input')[0].click();
    const toActive = http.expectOne({ method: 'PATCH', url: '/api/todos/1' });
    expect(toActive.request.body).toEqual({ status: 'act' });
    toActive.flush({ id: '1', desc: 'one', status: 'act' });
    fixture.detectChanges();
    expect(texts('activetasks')).toEqual(['one', 'two']);
    expect(texts('completedtasks')).toEqual([]);
  });

  it('should DELETE completed tasks and keep active ones', () => {
    start([
      { id: '1', desc: 'one', status: 'act' },
      { id: '2', desc: 'two', status: 'inv' },
    ]);

    root.querySelector<HTMLButtonElement>('.deletedbutton')!.click();
    const req = http.expectOne(
      (r) => r.method === 'DELETE' && r.url === '/api/todos' && r.params.get('status') === 'inv',
    );
    req.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(texts('completedtasks')).toEqual([]);
    expect(texts('activetasks')).toEqual(['one']);
    expect(root.querySelector('.deletedbutton')).toBeNull();
  });

  it('should show HTML in a task as plain text', () => {
    start([{ id: '1', desc: '<b>bold</b> & <script>x</script>', status: 'act' }]);
    expect(texts('activetasks')).toEqual(['<b>bold</b> & <script>x</script>']);
    expect(root.querySelector('.activetasks b')).toBeNull();
  });
});
