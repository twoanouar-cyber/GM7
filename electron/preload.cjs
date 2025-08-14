const { contextBridge, ipcRenderer } = require('electron');

// تعريف API متوافق مع واجهة TypeScript الخاصة بك
contextBridge.exposeInMainWorld('electronAPI', {
  // عمليات قاعدة البيانات
  query: (sql, params) => ipcRenderer.invoke('database-query', sql, params),
  run: (sql, params) => ipcRenderer.invoke('database-run', sql, params),

  // المصادقةش
  login: (username, password) => ipcRenderer.invoke('login', username, password),

  // إدارة المستخدمين
  createUser: (userData) => ipcRenderer.invoke('create-user', userData),
  updateUser: (userId, userData) => ipcRenderer.invoke('update-user', userId, userData),

  // إدارة قاعدة البيانات
  backupDatabase: () => ipcRenderer.invoke('backup-database'),
  backupDatabaseEnhanced: (options) => ipcRenderer.invoke('backup-database-enhanced', options),
  chooseBackupPath: () => ipcRenderer.invoke('choose-backup-path'),
  setupAutoBackup: (schedule, driveCredentials) => ipcRenderer.invoke('setup-auto-backup', schedule, driveCredentials),
  googleDriveAuth: () => ipcRenderer.invoke('google-drive-auth'),
  // --- التعديل الجديد هنا ---
  googleDriveGetToken: (code) => ipcRenderer.invoke('google-drive-get-token', code),
  restoreDatabase: () => ipcRenderer.invoke('restore-database'),
  repairDatabase: () => ipcRenderer.invoke('repair-database'),
  // --- إضافة الدالة الجديدة لإعادة التشغيل ---
  restartApp: () => ipcRenderer.invoke('restart-app'),

  // --- إضافة دالة للاستماع لحالة النسخ الاحتياطي من الملف الرئيسي ---
  onBackupStatusUpdate: (callback) => {
    // إزالة المستمعين القدامى لمنع تكرارهم
    ipcRenderer.removeAllListeners('backup-status-update');
    // إضافة مستمع جديد
    ipcRenderer.on('backup-status-update', (event, message) => callback(message));
  },

  // تصحيح الأخطاء (Debug)
  debugUsers: () => ipcRenderer.invoke('debug-users'),
  debugPasswords: () => ipcRenderer.invoke('debug-passwords'),
  debugLogin: (username, password) => ipcRenderer.invoke('debug-login', username, password),

  // معلومات النظام
  platform: process.platform,
  appVersion: () => ipcRenderer.invoke('app-version'),

  // التحكم في النافذة
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  closeApp: () => ipcRenderer.invoke('window-close'),

  // مربعات الحوار (Dialogs)
  showMessage: (options) => ipcRenderer.invoke('show-message', options),
  showError: (title, message) => ipcRenderer.invoke('show-error', title, message),
  showConfirm: (options) => ipcRenderer.invoke('show-confirm', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),

  // إعدادات Gym
  getGymSettings: () => ipcRenderer.invoke('get-gym-settings')
});
