import { createRoot } from 'react-dom/client'
import App from './App.tsx';
import './styles/index.css';
import ThemeProvider from './styles/theme'

createRoot(document.getElementById("root")!).render(
	<ThemeProvider>
		<App />
	</ThemeProvider>
);
