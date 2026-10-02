# VibeTour Pro - Real Estate Virtual Tour System

یک پلتفرم مدرن و سه‌بعدی برای ساخت و نمایش تورهای مجازی املاک لوکس بر پایه React، Tailwind CSS و Vite.

## 🚀 استقرار خودکار در GitHub Pages (Automatic GitHub Pages Deployment)

این مخزن به اکشن اتوماتیک **GitHub Actions** مجهز شده است (`.github/workflows/deploy.yml`). 
هر زمان کدهای جدید در مخزن گیت‌هاب پوش (Push) شوند یا پروژه به‌روزرسانی شود، گیت‌هاب به‌طور خودکار:
1. پروژه را بیلد می‌کند (`npm run build`).
2. سایت را در GitHub Pages منتشر و به‌روزرسانی می‌کند.

### ⚙️ فعال‌سازی یک‌باره در گیت‌هاب (فقط یک‌بار انجام دهید):
1. در صفحه مخزن گیت‌هاب خود به تب **Settings** بروید.
2. از منوی سمت چپ روی گزینه **Pages** کلیک کنید.
3. در بخش **Build and deployment > Source**، به جای Deploy from a branch، گزینه **GitHub Actions** را انتخاب کنید.
4. تمام! از این پس با هر تغییر، سایت شما در چند ثانیه به صورت خودکار آپدیت و منتشر می‌شود.

---

### دستورات توسعه محلی:
```bash
# نصب وابستگی‌ها
npm install

# اجرای سرور توسعه
npm run dev

# ساخت نسخه نهایی
npm run build
```
