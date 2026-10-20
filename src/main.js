import './styles/base.css';
import './styles/components.css';
import { startRouter } from './router.js';
import { registerServiceWorker } from './pwa.js';
import { initShortcuts } from './ui/shortcuts.js';
import { purgeOrphanImages } from './data/images.js';
import { seedIfFirstRun } from './data/seed.js';
import { homeView } from './ui/views/home.js';
import { deckEditorView } from './ui/views/deckEditor.js';
import { importView } from './ui/views/importView.js';
import { dataView } from './ui/views/dataView.js';
import { learnView } from './ui/views/learnView.js';
import { writeView } from './ui/views/writeView.js';
import { testView } from './ui/views/testView.js';
import { matchView } from './ui/views/matchView.js';
import { reviewView } from './ui/views/reviewView.js';
import { statsView } from './ui/views/statsView.js';
import { studyView } from './ui/views/study.js';

const routes = [
  [/^\/$/, homeView],
  [/^\/deck\/([^/]+)$/, deckEditorView],
  [/^\/study\/([^/]+)$/, studyView],
  [/^\/learn\/([^/]+)$/, learnView],
  [/^\/write\/([^/]+)$/, writeView],
  [/^\/test\/([^/]+)$/, testView],
  [/^\/match\/([^/]+)$/, matchView],
  [/^\/review(?:\/([^/]+))?$/, reviewView],
  [/^\/stats$/, statsView],
  [/^\/import(?:\/([^/]+))?$/, importView],
  [/^\/data$/, dataView],
];

initShortcuts();
registerServiceWorker();
// Ask the browser not to evict our data under storage pressure (it may ignore this, and that's fine).
navigator.storage?.persist?.();
await seedIfFirstRun();
startRouter(document.getElementById('app'), routes);

// Housekeeping once things have settled: drop stored pictures no card uses any more.
setTimeout(() => purgeOrphanImages().catch(console.error), 3000);
