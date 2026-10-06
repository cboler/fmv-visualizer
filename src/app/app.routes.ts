import { Routes } from '@angular/router';
import { WorkspaceComponent } from './workspace.component';
import { StatusComponent } from './status/status.component';

export const routes: Routes = [
  {
    path: '',
    component: WorkspaceComponent,
    title: 'Frame / Field · FMV & Telemetry',
  },
  {
    path: 'status',
    component: StatusComponent,
    title: 'Diagnostics · Frame / Field',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
