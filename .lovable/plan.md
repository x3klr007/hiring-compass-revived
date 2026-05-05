Rename the app brand from "ناشين للتوظيف" / "Nasheen Recruitment" to **مشروع مدارس طويق** in both Arabic and English locales.

### Change
In `src/contexts/I18nContext.tsx`:
- EN `appName`: `"Nasheen Recruitment"` → `"مشروع مدارس طويق"`
- AR `appName`: `"ناشين للتوظيف"` → `"مشروع مدارس طويق"`
- Taglines left unchanged.

This updates the auth page header, app shell, and any other surface using `t("appName")`.