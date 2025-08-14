import React, { useState, useEffect } from 'react';
import { Save, Settings, Building, Palette, Database, FileText, Upload, Download, FolderOpen, Cloud, Clock, CheckCircle2 } from 'lucide-react';
import { useGym } from '../../contexts/GymContext';

interface GymSettings {
  id: number;
  name: string;
  type: 'male' | 'female';
  logo: string;
  settings: {
    address?: string;
    phone?: string;
    email?: string;
    currency?: string;
    tax_rate?: number;
    receipt_footer?: string;
    backup_frequency?: string;
    theme_color?: string;
    auto_backup_schedule?: 'manual' | 'daily' | 'weekly' | 'monthly';
    drive_connected?: boolean;
    drive_credentials?: {
      client_id: string;
      client_secret: string;
      refresh_token: string;
    };
  };
}

const SettingsPage: React.FC = () => {
  const { gymId } = useGym();
  const [gymSettings, setGymSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    currency: 'DZD',
    tax_rate: '0',
    receipt_footer: '',
    theme_color: '#667eea',
    auto_backup_schedule: 'manual' as 'manual' | 'daily' | 'weekly' | 'monthly',
    drive_connected: false,
  });

  const [driveCredentials, setDriveCredentials] = useState<{ client_id: string; client_secret: string; refresh_token: string } | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [showAuthCodeInput, setShowAuthCodeInput] = useState(false);

  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string | null }>({ type: null, message: null });
  const [isBackupLoading, setIsBackupLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadGymSettings();
  }, [gymId]);

  const loadGymSettings = async () => {
    if (!gymId) return;
    try {
      setLoading(true);
      const data = await window.electronAPI.query(
        'SELECT * FROM gyms WHERE id = ?',
        [gymId]
      );
      
      if (data.length > 0) {
        const gym = data[0];
        const settings = gym.settings ? JSON.parse(gym.settings) : {};
        
        setGymSettings({ ...gym, settings });
        setFormData({
          name: gym.name,
          address: settings.address || '',
          phone: settings.phone || '',
          email: settings.email || '',
          currency: settings.currency || 'DZD',
          tax_rate: settings.tax_rate?.toString() || '0',
          receipt_footer: settings.receipt_footer || '',
          theme_color: settings.theme_color || '#667eea',
          auto_backup_schedule: settings.auto_backup_schedule || 'manual',
          drive_connected: !!settings.drive_credentials,
        });
        setDriveCredentials(settings.drive_credentials || null);
      }
    } catch (error) {
      console.error('Error loading gym settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async ({ credentialsToSave = driveCredentials } = {}) => {
    setSaving(true);
    
    try {
      const settings = {
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        currency: formData.currency,
        tax_rate: parseFloat(formData.tax_rate) || 0,
        receipt_footer: formData.receipt_footer,
        theme_color: formData.theme_color,
        auto_backup_schedule: formData.auto_backup_schedule,
        drive_connected: !!credentialsToSave,
        drive_credentials: credentialsToSave,
      };

      await window.electronAPI.run(`
        UPDATE gyms 
        SET name = ?, settings = ?
        WHERE id = ?
      `, [formData.name, JSON.stringify(settings), gymId]);
      
      // Update state directly after saving
      setFormData(prev => ({ ...prev, drive_connected: !!credentialsToSave }));
      setDriveCredentials(credentialsToSave);

      alert('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('حدث خطأ في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      setIsBackupLoading(true);
      setBackupStatus({ type: 'info', message: 'جاري إنشاء نسخة احتياطية...' });

      const result = await window.electronAPI.backupDatabaseEnhanced();
      
      if (result.error) {
        setBackupStatus({ type: 'error', message: `فشل النسخ الاحتياطي: ${result.error}` });
      } else {
        setBackupStatus({ 
          type: 'success', 
          message: `تم إنشاء نسخة احتياطية بنجاح في: ${result.path}` 
        });
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      setBackupStatus({ type: 'error', message: `حدث خطأ غير متوقع: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const confirmResult = await window.electronAPI.showConfirm({
        title: 'استعادة قاعدة البيانات',
        message: 'هل أنت متأكد من استعادة قاعدة البيانات من نسخة احتياطية؟',
        detail: 'سيتم استبدال جميع البيانات الحالية بالبيانات من النسخة الاحتياطية. هذا الإجراء لا يمكن التراجع عنه.',
        buttons: ['استعادة', 'إلغاء'],
        defaultId: 1,
        cancelId: 1
      });

      if (confirmResult.response === 1) {
        return;
      }

      setIsBackupLoading(true);
      setBackupStatus({ type: 'info', message: 'جاري استعادة النسخة الاحتياطية...' });

      const result = await window.electronAPI.restoreDatabase();
      
      if (result.canceled) {
        setBackupStatus({ type: null, message: null });
        return;
      }
      
      if (result.error) {
        setBackupStatus({ type: 'error', message: `فشل استعادة قاعدة البيانات: ${result.error}` });
      } else if (result.success) {
        setBackupStatus({ type: 'success', message: 'تم استعادة قاعدة البيانات بنجاح' });
        
        const restartResult = await window.electronAPI.showConfirm({
          title: 'إعادة تشغيل التطبيق',
          message: 'يجب إعادة تشغيل التطبيق لتطبيق التغييرات',
          detail: 'هل تريد إعادة تشغيل التطبيق الآن؟',
          buttons: ['إعادة تشغيل', 'لاحقاً'],
          defaultId: 0
        });
        
        if (restartResult.response === 0) {
          window.electronAPI.restartApp();
        }
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
      setBackupStatus({ type: 'error', message: `حدث خطأ غير متوقع: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleRepairDatabase = async () => {
    try {
      const confirmResult = await window.electronAPI.showConfirm({
        title: 'إصلاح قاعدة البيانات',
        message: 'هل تريد إصلاح وتحسين أداء قاعدة البيانات؟',
        detail: 'سيقوم هذا الإجراء بإصلاح وتحسين أداء قاعدة البيانات. قد يستغرق بعض الوقت.',
        buttons: ['إصلاح', 'إلغاء'],
        defaultId: 1,
        cancelId: 1
      });

      if (confirmResult.response === 1) {
        return;
      }

      setIsBackupLoading(true);
      setBackupStatus({ type: 'info', message: 'جاري إصلاح قاعدة البيانات...' });

      const result = await window.electronAPI.repairDatabase();
      
      if (result.error) {
        setBackupStatus({ type: 'error', message: `فشل إصلاح قاعدة البيانات: ${result.error}` });
      } else {
        setBackupStatus({ type: 'success', message: 'تم إصلاح وتحسين قاعدة البيانات بنجاح' });
      }
    } catch (error) {
      console.error('Error repairing database:', error);
      setBackupStatus({ type: 'error', message: `حدث خطأ غير متوقع: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleClearAllData = async () => {
    try {
      const firstConfirm = await window.electronAPI.showConfirm({
        title: 'تحذير: حذف جميع البيانات',
        message: 'هل أنت متأكد من حذف جميع البيانات؟',
        detail: 'سيتم حذف جميع البيانات باستثناء حسابات المستخدمين. هذا الإجراء لا يمكن التراجع عنه!',
        buttons: ['نعم، احذف جميع البيانات', 'إلغاء'],
        defaultId: 1,
        cancelId: 1
      });

      if (firstConfirm.response === 1) {
        return;
      }

      const secondConfirm = await window.electronAPI.showConfirm({
        title: 'تأكيد نهائي',
        message: 'هذا هو التأكيد الأخير!',
        detail: 'سيتم حذف جميع المنتجات، المبيعات، المشتركين، والفواتير نهائياً. هل تريد المتابعة؟',
        buttons: ['نعم، احذف نهائياً', 'إلغاء'],
        defaultId: 1,
        cancelId: 1
      });

      if (secondConfirm.response === 1) {
        return;
      }

      setIsClearing(true);
      setBackupStatus({ type: 'info', message: 'جاري حذف البيانات...' });

      const tablesToClear = [
        'invoice_items',
        'invoices',
        'purchase_items',
        'purchases',
        'internal_sales',
        'subscribers',
        'subscription_types',
        'products',
        'categories',
        'customers'
      ];

      for (const table of tablesToClear) {
        await window.electronAPI.run(`DELETE FROM ${table}`);
      }

      setBackupStatus({ type: 'success', message: 'تم حذف جميع البيانات بنجاح! يمكنك الآن البدء من جديد.' });
    } catch (error) {
      console.error('Error clearing data:', error);
      setBackupStatus({ type: 'error', message: `حدث خطأ في حذف البيانات: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsClearing(false);
    }
  };

  // NEW: Handle Google Drive authentication flow
  const handleConnectGoogleDrive = async () => {
    setIsDriveConnecting(true);
    setBackupStatus({ type: 'info', message: 'جاري فتح صفحة المصادقة...' });
    try {
      const result = await window.electronAPI.googleDriveAuth();
      if (result.success && result.authUrl) {
        // Open the authentication URL in the default browser
        window.open(result.authUrl);
        setBackupStatus({ type: 'info', message: 'تم فتح نافذة المتصفح. يرجى إكمال المصادقة ونسخ الرمز هنا.' });
        setShowAuthCodeInput(true);
      } else {
        setBackupStatus({ type: 'error', message: result.error || 'فشل في بدء عملية المصادقة مع Google Drive.' });
      }
    } catch (error) {
      console.error('Error connecting Google Drive:', error);
      setBackupStatus({ type: 'error', message: `حدث خطأ غير متوقع: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsDriveConnecting(false);
    }
  };

  // NEW: Handle confirmation of the authentication code
  const handleConfirmAuthCode = async () => {
    if (!authCode) {
      setBackupStatus({ type: 'error', message: 'الرجاء إدخال رمز المصادقة.' });
      return;
    }
    setIsDriveConnecting(true);
    setBackupStatus({ type: 'info', message: 'جاري تأكيد رمز المصادقة...' });
    try {
      const result = await window.electronAPI.googleDriveGetToken(authCode);
      if (result.success && result.credentials) {
        setBackupStatus({ type: 'success', message: 'تم ربط Google Drive بنجاح!' });
        await handleSave({ credentialsToSave: result.credentials });
        setAuthCode('');
        setShowAuthCodeInput(false);
      } else {
        setBackupStatus({ type: 'error', message: result.error || 'فشل في تأكيد الرمز. يرجى المحاولة مجدداً.' });
      }
    } catch (error) {
      console.error('Error confirming auth code:', error);
      setBackupStatus({ type: 'error', message: `حدث خطأ غير متوقع: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsDriveConnecting(false);
    }
  };

  const handleCreateDriveBackup = async () => {
    try {
      if (!driveCredentials) {
        setBackupStatus({ type: 'error', message: 'يرجى ربط حساب Google Drive أولاً.' });
        return;
      }

      setIsBackupLoading(true);
      setBackupStatus({ type: 'info', message: 'جاري إنشاء نسخة احتياطية ورفعها إلى Google Drive...' });

      const result = await window.electronAPI.backupDatabaseEnhanced({
        uploadToDrive: true,
        driveCredentials: driveCredentials
      });
      
      if (result.error) {
        setBackupStatus({ type: 'error', message: `فشل النسخ الاحتياطي: ${result.error}` });
      } else {
        setBackupStatus({ 
          type: 'success', 
          message: `تم إنشاء نسخة احتياطية ورفعها إلى Google Drive بنجاح.` 
        });
      }
    } catch (error) {
      console.error('Error creating Drive backup:', error);
      setBackupStatus({ type: 'error', message: `حدث خطأ غير متوقع: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleSetupAutoBackup = async () => {
    try {
      const updatedSettings = {
        ...gymSettings?.settings,
        auto_backup_schedule: formData.auto_backup_schedule,
        drive_credentials: driveCredentials
      };
      await window.electronAPI.run(`
        UPDATE gyms 
        SET settings = ?
        WHERE id = ?
      `, [JSON.stringify(updatedSettings), gymId]);

      const result = await window.electronAPI.setupAutoBackup(formData.auto_backup_schedule, driveCredentials);
      
      if (result.success) {
        setBackupStatus({ 
          type: 'success', 
          message: `تم إعداد النسخ الاحتياطي التلقائي: ${formData.auto_backup_schedule}` 
        });
      } else {
        setBackupStatus({ type: 'error', message: result.error || 'فشل في إعداد النسخ التلقائي' });
      }
    } catch (error) {
      console.error('Error setting up auto backup:', error);
      setBackupStatus({ type: 'error', message: 'حدث خطأ في إعداد النسخ التلقائي' });
    }
  };

  const tabs = [
    { id: 'general', label: 'عام', icon: Building },
    { id: 'appearance', label: 'المظهر', icon: Palette },
    { id: 'receipts', label: 'الفواتير', icon: FileText },
    { id: 'backup', label: 'النسخ الاحتياطي', icon: Database }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 arabic-text">
            الإعدادات
          </h1>
          <p className="text-gray-600 arabic-text">
            إعدادات النظام والصالة
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary-ar arabic-text flex items-center"
        >
          <Save className="w-5 h-5 ml-2" />
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card-ar">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 text-right rounded-lg transition-colors arabic-text ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 ml-3" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="card-ar">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="flex items-center mb-6">
                  <Building className="w-6 h-6 ml-3 text-blue-600" />
                  <h2 className="text-xl font-semibold arabic-text">الإعدادات العامة</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group-ar">
                    <label className="form-label-ar arabic-text">
                      اسم الصالة *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="form-input-ar"
                      placeholder="اسم الصالة"
                      required
                    />
                  </div>

                  <div className="form-group-ar">
                    <label className="form-label-ar arabic-text">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="form-input-ar"
                      placeholder="رقم الهاتف"
                    />
                  </div>
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    العنوان
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="form-input-ar"
                    placeholder="عنوان الصالة"
                    rows={3}
                  />
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="form-input-ar"
                    placeholder="البريد الإلكتروني"
                  />
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="flex items-center mb-6">
                  <Palette className="w-6 h-6 ml-3 text-blue-600" />
                  <h2 className="text-xl font-semibold arabic-text">إعدادات المظهر</h2>
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    لون النظام الأساسي
                  </label>
                  <div className="flex items-center space-x-reverse space-x-4">
                    <input
                      type="color"
                      value={formData.theme_color}
                      onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                      className="w-12 h-12 rounded-lg border-2 border-gray-300"
                    />
                    <input
                      type="text"
                      value={formData.theme_color}
                      onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                      className="form-input-ar flex-1"
                      placeholder="#667eea"
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2 arabic-text">معاينة الألوان</h3>
                  <div className="flex space-x-reverse space-x-4">
                    <div 
                      className="w-16 h-16 rounded-lg shadow-md"
                      style={{ backgroundColor: formData.theme_color }}
                    ></div>
                    <div 
                      className="w-16 h-16 rounded-lg shadow-md"
                      style={{ backgroundColor: formData.theme_color + '80' }}
                    ></div>
                    <div 
                      className="w-16 h-16 rounded-lg shadow-md"
                      style={{ backgroundColor: formData.theme_color + '40' }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'receipts' && (
              <div className="space-y-6">
                <div className="flex items-center mb-6">
                  <FileText className="w-6 h-6 ml-3 text-blue-600" />
                  <h2 className="text-xl font-semibold arabic-text">إعدادات الفواتير</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group-ar">
                    <label className="form-label-ar arabic-text">
                      العملة
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="form-select-ar"
                    >
                      <option value="DZD">دينار جزائري (DZD)</option>
                      <option value="USD">دولار أمريكي (USD)</option>
                      <option value="EUR">يورو (EUR)</option>
                    </select>
                  </div>

                  <div className="form-group-ar">
                    <label className="form-label-ar arabic-text">
                      معدل الضريبة (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                      className="form-input-ar"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="form-group-ar">
                  <label className="form-label-ar arabic-text">
                    نص أسفل الفاتورة
                  </label>
                  <textarea
                    value={formData.receipt_footer}
                    onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                    className="form-input-ar"
                    placeholder="شكراً لزيارتكم نادينا الرياضي"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-6">
                <div className="flex items-center mb-6">
                  <Database className="w-6 h-6 ml-3 text-blue-600" />
                  <h2 className="text-xl font-semibold arabic-text">النسخ الاحتياطي</h2>
                </div>

                {backupStatus.type && (
                  <div className={`p-4 rounded-md ${
                    backupStatus.type === 'success' ? 'bg-green-100 text-green-800' :
                    backupStatus.type === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {backupStatus.message}
                  </div>
                )}
                
                {/* Manual Backup and Restore Section */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                  <h3 className="font-semibold text-gray-800 arabic-text">النسخ الاحتياطي اليدوي</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                      onClick={handleBackup}
                      disabled={isBackupLoading}
                      className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 arabic-text"
                    >
                      <Upload className="ml-2" size={18} />
                      إنشاء نسخة احتياطية
                    </button>
                    
                    <button
                      onClick={handleRestore}
                      disabled={isBackupLoading}
                      className="flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 arabic-text"
                    >
                      <Download className="ml-2" size={18} />
                      استعادة من نسخة احتياطية
                    </button>
                    
                    <button
                      onClick={() => window.electronAPI.openBackupFolder()}
                      className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md transition-colors arabic-text"
                    >
                      <FolderOpen className="ml-2" size={18} />
                      فتح مجلد النسخ الاحتياطية
                    </button>
                  </div>
                </div>

                {/* Google Drive Integration Section - UPDATED */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-blue-800 arabic-text">ربط Google Drive</h3>
                  <p className="text-sm text-gray-600 arabic-text">
                    اربط حسابك في Google Drive لإنشاء نسخ احتياطية سحابية.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={handleConnectGoogleDrive}
                      disabled={isBackupLoading || formData.drive_connected}
                      className={`flex items-center justify-center py-2 px-4 rounded-md transition-colors arabic-text ${
                        formData.drive_connected 
                          ? 'bg-green-600 text-white cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:bg-gray-400`}
                    >
                      {formData.drive_connected ? (
                        <>
                          <CheckCircle2 className="ml-2" size={18} />
                          مربوط بـ Google Drive
                        </>
                      ) : (
                        <>
                          <Cloud className="ml-2" size={18} />
                          ربط Google Drive
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleCreateDriveBackup}
                      // تم التعديل: تفعيل الزر فقط عند وجود ارتباط فعلي
                      disabled={isBackupLoading || !formData.drive_connected}
                      className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 arabic-text"
                    >
                      <Cloud className="ml-2" size={18} />
                      نسخ احتياطي إلى Drive
                    </button>
                  </div>

                  {showAuthCodeInput && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 arabic-text">
                        بعد إكمال المصادقة في المتصفح، يرجى نسخ الرمز الذي تحصل عليه ولصقه هنا.
                      </p>
                      <div className="flex items-end space-x-reverse space-x-4">
                        <div className="flex-1">
                          <label className="form-label-ar arabic-text">رمز المصادقة</label>
                          <input
                            type="text"
                            value={authCode}
                            onChange={(e) => setAuthCode(e.target.value)}
                            className="form-input-ar"
                            placeholder="الصق الرمز هنا..."
                          />
                        </div>
                        <button
                          onClick={handleConfirmAuthCode}
                          disabled={isDriveConnecting}
                          className="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 h-[42px] arabic-text"
                        >
                          تأكيد الرمز
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Auto Backup Scheduling Section */}
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-purple-800 arabic-text">النسخ الاحتياطي التلقائي</h3>
                  <div className="flex items-end space-x-reverse space-x-4">
                    <div className="flex-1">
                      <label className="form-label-ar arabic-text">جدولة النسخ التلقائي</label>
                      <select
                        value={formData.auto_backup_schedule}
                        onChange={(e) => setFormData({ ...formData, auto_backup_schedule: e.target.value as 'manual' | 'daily' | 'weekly' | 'monthly' })}
                        className="form-select-ar"
                      >
                        <option value="manual">يدوي فقط</option>
                        <option value="daily">يومياً</option>
                        <option value="weekly">أسبوعياً</option>
                        <option value="monthly">شهرياً</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={handleSetupAutoBackup}
                      disabled={isBackupLoading || formData.auto_backup_schedule === gymSettings?.settings.auto_backup_schedule}
                      className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 h-[42px] arabic-text"
                    >
                      <Clock className="ml-2" size={18} />
                      تطبيق الجدولة
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 arabic-text">
                    النسخ الاحتياطي التلقائي سيتم تنفيذه في الساعة 2:00 صباحًا بتوقيت الجهاز.
                  </p>
                </div>
                
                {/* Danger Zone */}
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-red-800 arabic-text">منطقة الخطر</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-red-600 arabic-text">
                        إصلاح وتحسين قاعدة البيانات لتحسين الأداء. هذا الإجراء آمن.
                      </p>
                      <button
                        onClick={handleRepairDatabase}
                        disabled={isBackupLoading}
                        className="w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 arabic-text"
                      >
                        <Settings className="ml-2" size={18} />
                        إصلاح وتحسين
                      </button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-red-600 arabic-text">
                        حذف جميع البيانات باستثناء حسابات المستخدمين. هذا الإجراء لا يمكن التراجع عنه!
                      </p>
                      <button
                        onClick={handleClearAllData}
                        disabled={isClearing}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-400 arabic-text"
                      >
                        {isClearing ? 'جاري الحذف...' : 'حذف جميع البيانات'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;