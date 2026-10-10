// إعدادات الربط بقاعدة البيانات — عدّل القيمتين من: Supabase → Project Settings → API
// المفتاح العام (anon) آمن للنشر لأن صلاحيات القراءة والكتابة محمية بسياسات قاعدة البيانات.
window.RAKZ_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-KEY",
  ownerEmail: "", // بريد المدير الرئيسي (اختياري): يمنحه صلاحية الإسناد قبل إضافة الفريق
};
