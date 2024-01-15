import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Todo } from './todo.model';

@Injectable({
  providedIn: 'root',
})
export class TodoService {
  BASE_URL =
    'https://backend.victoriousriver-f80e1062.australiaeast.azurecontainerapps.io/items';

  constructor(private http: HttpClient) {}

  getTodos(): Observable<Todo[]> {
    return this.http.get<any>(this.BASE_URL).pipe(
      map((todos) => todos._embedded.items),
      tap((results) => console.log(results))
    );
  }

  createTodo(model: Todo): Observable<any> {
    return this.http.post(this.BASE_URL, model);
  }

  updateTodo(id: string, model: Todo): Observable<any> {
    return this.http.put(this.BASE_URL.concat(`/${id}`), model);
  }

  deleteTodo(id: string): Observable<any> {
    return this.http.delete(this.BASE_URL.concat(`/${id}`));
  }
}
