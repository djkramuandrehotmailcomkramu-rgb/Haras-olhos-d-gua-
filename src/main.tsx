import { render } from 'preact';
import { App } from './App';
import './styles.css';
import 'leaflet/dist/leaflet.css';

render(<App />, document.getElementById('app')!);
