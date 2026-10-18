import './styles/base.css';
import './styles/components.css';
import { startRouter } from './router.js';
import { seedIfFirstRun } from './data/seed.js';
import { homeView } from './ui/views/home.js';
import { deckEditorView } from './ui/views/deckEditor.js';
import { studyView } from './ui/views/study.js';

const routes = [
  [/^\/$/, homeView],
  [/^\/deck\/([^/]+)$/, deckEditorView],
  [/^\/study\/([^/]+)$/, studyView],
];

await seedIfFirstRun();
startRouter(document.getElementById('app'), routes);
