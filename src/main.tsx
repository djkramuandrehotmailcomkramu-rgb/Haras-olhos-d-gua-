import { render } from 'preact';
import { App } from './App';
import './styles.css';
import 'leaflet/dist/leaflet.css';

import { aplicarPreferencias } from './state';
aplicarPreferencias();
render(<App />, document.getElementById('app')!);
