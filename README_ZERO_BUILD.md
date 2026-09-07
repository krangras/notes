# GitHub Pages — zero build

Эта версия намеренно НЕ использует Node.js, npm, GitHub Actions или сборку.

## Установка

1. Положить `index.html`, `app.js`, `styles.css`, `.nojekyll` в КОРЕНЬ репозитория `notes`.
2. Старые файлы сборки можно удалить:
   - `.github/workflows/pages.yml`
   - `package.json`
   - `package-lock.json`
   - `site.config.json`
   - папку `site/`
   - папку `dist/`
3. Сделать commit/push.
4. GitHub → Settings → Pages.
5. В `Build and deployment`:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/(root)`
   - Save

Сайт: https://krangras.github.io/notes/

## Как работает

GitHub Pages раздаёт файлы репозитория напрямую.
`index.html` показывает каталог.
При открытии линейной алгебры браузер получает `Линейная_алгебра_1_семестр.md` из того же GitHub Pages, превращает его в статью и рендерит LaTeX через MathJax 4.

Рисунки из `assets/...` остаются по тем же относительным путям и отображаются прямо в статье.
Для каждого `<a id="ticket-N"></a>` создаётся отдельная кнопка `Копировать билет`, копирующая исходный Markdown/LaTeX именно этого билета.

Единственная внешняя зависимость во время просмотра — MathJax 4 с jsDelivr CDN.
