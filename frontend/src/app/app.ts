import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Todo, TodoService } from './todo.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly service = inject(TodoService);

  protected readonly todos = signal<Todo[]>([]);
  protected readonly activeTodos = computed(() => this.todos().filter((todo) => todo.status === 'act'));
  protected readonly completedTodos = computed(() => this.todos().filter((todo) => todo.status === 'inv'));
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.service.list().subscribe({
      next: (todos) => this.todos.set(todos),
      error: () => this.error.set('Could not load tasks. Is the API running?'),
    });
  }

  add(text: string): void {
    const desc = text.trim();
    if (!desc) {
      return;
    }
    this.service.add(desc).subscribe({
      next: (todo) => {
        this.error.set(null);
        this.todos.update((todos) => [...todos, todo]);
      },
      error: () => this.error.set('Could not add the task.'),
    });
  }

  toggle(todo: Todo): void {
    const status = todo.status === 'act' ? 'inv' : 'act';
    this.service.setStatus(todo.id, status).subscribe({
      next: (updated) => {
        this.error.set(null);
        this.todos.update((todos) => todos.map((item) => (item.id === updated.id ? updated : item)));
      },
      error: () => this.error.set('Could not update the task.'),
    });
  }

  clearCompleted(): void {
    this.service.removeByStatus('inv').subscribe({
      next: () => {
        this.error.set(null);
        this.todos.update((todos) => todos.filter((todo) => todo.status !== 'inv'));
      },
      error: () => this.error.set('Could not delete the tasks.'),
    });
  }
}
