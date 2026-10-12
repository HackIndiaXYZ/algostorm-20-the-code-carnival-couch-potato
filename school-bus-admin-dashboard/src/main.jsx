import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import 'leaflet/dist/leaflet.css';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('SchoolWay dashboard render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return <div style={{fontFamily:'system-ui,sans-serif',maxWidth:760,margin:'8vh auto',padding:28,color:'#18304b',background:'#fff',border:'1px solid #f0c7c7',borderRadius:16,boxShadow:'0 12px 40px #0d274711'}}>
        <p style={{fontSize:12,fontWeight:700,letterSpacing:'.12em',color:'#c24141'}}>SCHOOLWAY · STARTUP ERROR</p>
        <h1 style={{marginBottom:8}}>The dashboard hit a runtime error.</h1>
        <p style={{color:'#64748b',lineHeight:1.6}}>Copy the error below and share it so the issue can be diagnosed. Also confirm that you started the app with <code>npm run dev</code>, not by opening index.html directly.</p>
        <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#fff5f5',padding:16,borderRadius:10,color:'#8b2525'}}>{String(this.state.error?.stack || this.state.error)}</pre>
        <button onClick={() => window.location.reload()} style={{border:0,borderRadius:9,padding:'11px 16px',background:'#246dc3',color:'#fff',fontWeight:700,cursor:'pointer'}}>Reload dashboard</button>
      </div>;
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Required #root element was not found in index.html');
createRoot(rootElement).render(<React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>);
