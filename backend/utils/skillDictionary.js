// Baseline extractor vocabulary (canonical name -> aliases). Stage 3 adds embedding-based matching on top.
const D = { JavaScript: ['javascript', 'js', 'es6'], TypeScript: ['typescript'], Java: ['java'], Python: ['python'], 'C++': ['c++'], SQL: ['sql', 'mysql', 'postgresql', 'sqlite'],
  MongoDB: ['mongodb', 'mongoose'], React: ['react', 'react.js', 'reactjs'], Angular: ['angular'], 'Node.js': ['node.js', 'nodejs', 'node'], Express: ['express', 'express.js'],
  HTML: ['html', 'html5'], CSS: ['css', 'css3', 'tailwind', 'bootstrap'], Django: ['django'], Flask: ['flask'], FastAPI: ['fastapi'], 'Spring Boot': ['spring boot', 'spring'],
  Docker: ['docker'], Git: ['git', 'github'], AWS: ['aws'], 'CI/CD': ['ci/cd', 'jenkins', 'github actions'], Excel: ['excel'], Pandas: ['pandas'], NumPy: ['numpy'],
  TensorFlow: ['tensorflow', 'keras'], PyTorch: ['pytorch'], 'Scikit-learn': ['scikit-learn', 'sklearn'], 'Machine Learning': ['machine learning', 'ml'],
  'Deep Learning': ['deep learning', 'neural network'], NLP: ['nlp', 'natural language processing'], 'REST APIs': ['rest api', 'restful', 'rest apis'] };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const RX = Object.entries(D).map(([name, al]) => [name, new RegExp(`(?<![A-Za-z0-9+#])(${al.map(esc).join('|')})(?![A-Za-z0-9+#])`, 'i')]);
exports.extractSkills = (text) => RX.filter(([, rx]) => rx.test(text)).map(([n]) => n);
exports.ALL_SKILLS = Object.keys(D);
