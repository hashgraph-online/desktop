import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronTest', {
  ping: () => 'pong',
  isWorking: true
});