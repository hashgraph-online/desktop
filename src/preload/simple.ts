import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  test: () => 'IT WORKS!'
});