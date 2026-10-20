import './styles/base.css';
import './styles/components.css';
import { startRouter } from './router.js';
import { seedIfFirstRun } from './data/seed.js';
import { homeView } from './ui/views/home.js';
import { deckEditorView } from './ui/views/deckEditor.js';
import { importView } from './ui/views/importView.js';
import { dataView } from './ui/views/dataView.js';
import { learnView } from './ui/views/learnView.js';
import { writeView } from './ui/views/writeView.js';
import { testView } from './ui/views/testView.js';
import { matchView } from './ui/views/matchView.js';
import { studyView } from './ui/views/study.js';

const routes = [
  [/^\/$/, homeView],
  [/^\/deck\/([^/]+)$/, deckEditorView],
  [/^\/study\/([^/]+)$/, studyView],
  [/^\/learn\/([^/]+)$/, learnView],
  [/^\/write\/([^/]+)$/, writeView],
  [/^\/test\/([^/]+)$/, testView],
  [/^\/match\/([^/]+)$/, matchView],
  [/^\/import(?:\/([^/]+))?$/, importView],
  [/^\/data$/, dataView],
];

await seedIfFirstRun();
startRouter(document.getElementById('app'), routes);
