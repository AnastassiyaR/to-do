import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** "act" = active, "inv" = inactive (completed) */
export type TodoStatus = 'act' | 'inv';

export interface Todo {
  id: string;
  desc: string;
  status: TodoStatus;
}

@Injectable({ providedIn: 'root' })
export class TodoService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/todos';

  list(): Observable<Todo[]> {
    return this.http.get<Todo[]>(this.url);
  }

  add(desc: string): Observable<Todo> {
    return this.http.post<Todo>(this.url, { desc });
  }

  setStatus(id: string, status: TodoStatus): Observable<Todo> {
    return this.http.patch<Todo>(`${this.url}/${id}`, { status });
  }

  removeByStatus(status: TodoStatus): Observable<void> {
    return this.http.delete<void>(this.url, { params: { status } });
  }
}
