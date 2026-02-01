// CodePen Clone - Professional Code Editor
class LiveMarkup {
  constructor() {
    this.editors = {};
    this.currentPanel = 'html';
    this.projectData = {
      title: 'My Awesome Project',
      html: '',
      css: '',
      js: ''
    };

    // Default settings
    this.settings = {
      theme: 'monokai',
      fontSize: 14,
      autoSave: true,
      livePreview: true,
      tabSize: 4,
      wordWrap: true,
      lineNumbers: true,
      autoComplete: true,
      layout: 'horizontal'
    };

    this.lastWidthBucket = '';

    // Force clear any cached content for guest mode
    this.clearGuestModeCache();

    this.loadSettings();
    this.init();
  }

  clearGuestModeCache() {
    // Clear all possible storage locations that might contain old cached content
    localStorage.removeItem('livemarkup-project');
    sessionStorage.removeItem('livemarkup-project');

    // Also clear any other potential cache keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('livemarkup') || key.includes('project')) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage too
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes('livemarkup') || key.includes('project')) {
        sessionKeysToRemove.push(key);
      }
    }

    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
  }

  init() {
    this.setupAccessibilityFeatures();
    this.initializeEditors();
    this.setupEventListeners();
    this.setupConsoleListener();
    this.setupResizeHandle();
    this.updateCharacterCount();

    // Load default content for new users
    this.loadDefaultContent();
    this.updatePreview();
  }

  initializeEditors() {
    const commonOptions = {
      lineNumbers: this.settings.lineNumbers,
      theme: this.settings.theme,
      autoCloseBrackets: true,
      matchBrackets: true,
      indentWithTabs: false,
      tabSize: this.settings.tabSize,
      indentUnit: this.settings.tabSize,
      lineWrapping: this.settings.wordWrap,
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      extraKeys: { "Ctrl-Space": "autocomplete" }
    };

    this.editors.html = CodeMirror.fromTextArea(document.getElementById('html-code'), {
      ...commonOptions,
      mode: 'text/html'
    });

    this.editors.css = CodeMirror.fromTextArea(document.getElementById('css-code'), {
      ...commonOptions,
      mode: 'css'
    });

    this.editors.js = CodeMirror.fromTextArea(document.getElementById('js-code'), {
      ...commonOptions,
      mode: 'javascript'
    });

    // Add change listeners
    Object.keys(this.editors).forEach(key => {
      this.editors[key].on('change', () => {
        this.onEditorChange();
      });
    });

    // Apply initial settings after editors are initialized
    this.applySettings();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.closest('.tab').dataset.panel);
      });
    });

    // Project title
    const projectTitleInput = document.getElementById('projectTitle');
    if (projectTitleInput) {
      projectTitleInput.addEventListener('input', (e) => {
        this.projectData.title = e.target.value;
        this.saveProject();
      });
    }

    // Settings listeners
    const getEl = (id) => document.getElementById(id);

    getEl('editor-theme')?.addEventListener('change', (e) => {
      this.settings.theme = e.target.value;
      this.applySettings();
    });

    getEl('font-size')?.addEventListener('input', (e) => {
      this.settings.fontSize = parseInt(e.target.value);
      getEl('font-size-value').textContent = this.settings.fontSize + 'px';
      this.applySettings();
    });

    getEl('auto-save')?.addEventListener('change', (e) => {
      this.settings.autoSave = e.target.checked;
      this.saveSettings();
    });

    getEl('live-preview')?.addEventListener('change', (e) => {
      this.settings.livePreview = e.target.checked;
      this.saveSettings();
    });

    getEl('tab-size')?.addEventListener('change', (e) => {
      this.settings.tabSize = parseInt(e.target.value);
      this.applySettings();
    });

    getEl('word-wrap')?.addEventListener('change', (e) => {
      this.settings.wordWrap = e.target.checked;
      this.applySettings();
    });

    getEl('line-numbers')?.addEventListener('change', (e) => {
      this.settings.lineNumbers = e.target.checked;
      this.applySettings();
    });

    getEl('auto-complete')?.addEventListener('change', (e) => {
      this.settings.autoComplete = e.target.checked;
      this.applySettings();
    });

    getEl('layout-mode')?.addEventListener('change', (e) => {
      this.settings.layout = e.target.value;
      this.applySettings();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            this.saveProject();
            break;
          case 'Enter':
            e.preventDefault();
            this.compile();
            break;
        }
      }
    });
  }

  switchTab(panel) {
    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-panel="${panel}"]`).classList.add('active');

    // Update panels
    document.querySelectorAll('.editor-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.getElementById(`${panel}-panel`).classList.add('active');

    this.currentPanel = panel;

    // Refresh editor (only for code editors that exist, not console)
    if (panel !== 'console' && this.editors && this.editors[panel] && this.editors[panel].refresh) {
      setTimeout(() => {
        this.editors[panel].refresh();
      }, 100);
    }
  }

  onEditorChange() {
    this.updateCharacterCount();

    if (this.settings.livePreview) {
      this.compile();
    }

    if (this.settings.autoSave) {
      this.debounceSave();
    }
  }

  compile() {
    const html = this.editors.html.getValue() || '';
    const css = this.editors.css.getValue() || '';
    const js = this.editors.js.getValue() || '';

    const preview = document.getElementById('preview');

    // Clear console before each compilation
    this.clearConsole();

    // Create enhanced HTML content with console capture
    const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${css}</style>
  </head>
  <body>
    ${html}
    <script>
      // Console capture script
      (function() {
        const originalConsole = {
          log: console.log,
          error: console.error,
          warn: console.warn,
          info: console.info
        };
        
        function sendToParent(type, ...args) {
          const message = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              try {
                return JSON.stringify(arg, null, 2);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          }).join(' ');
          
          window.parent.postMessage({
            type: 'console',
            level: type,
            message: message,
            timestamp: new Date().toISOString()
          }, '*');
        }
        
        console.log = function(...args) {
          originalConsole.log.apply(console, args);
          sendToParent('log', ...args);
        };
        
        console.error = function(...args) {
          originalConsole.error.apply(console, args);
          sendToParent('error', ...args);
        };
        
        console.warn = function(...args) {
          originalConsole.warn.apply(console, args);
          sendToParent('warn', ...args);
        };
        
        console.info = function(...args) {
          originalConsole.info.apply(console, args);
          sendToParent('info', ...args);
        };
        
        // Capture unhandled errors
        window.addEventListener('error', function(event) {
          sendToParent('error', event.message, event.filename, event.lineno, event.colno);
        });
        
        window.addEventListener('unhandledrejection', function(event) {
          sendToParent('error', 'Unhandled Promise Rejection:', event.reason);
        });
      })();
      
      // User code
      ${js}
    </script>
  </body>
</html>`;

    // Use srcdoc attribute to avoid document.write issues
    preview.srcdoc = htmlContent;
  }

  saveProject() {
    this.projectData.html = this.editors.html.getValue();
    this.projectData.css = this.editors.css.getValue();
    this.projectData.js = this.editors.js.getValue();

    localStorage.setItem('livemarkup-project', JSON.stringify(this.projectData));
    this.showStatus('Project saved');
  }

  updatePreview() {
    this.compile();
  }

  loadProject() {
    const saved = localStorage.getItem('livemarkup-project');
    if (saved) {
      this.projectData = JSON.parse(saved);

      document.getElementById('projectTitle').value = this.projectData.title;
      this.editors.html.setValue(this.projectData.html);
      this.editors.css.setValue(this.projectData.css);
      this.editors.js.setValue(this.projectData.js);

      this.updatePreview();
      this.showStatus('Project loaded');
    } else {
      this.showStatus('No saved project found');
    }
  }

  loadDefaultContent() {
    const defaultHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LiveMarkup Editor</title>
</head>
<body>
    <div class="container">
        <h1>Welcome to LiveMarkup</h1>
        <p>Start coding and see your changes in real-time.</p>
        <button id="myButton">Click Me</button>
    </div>
</body>
</html>`;




    const defaultCSS = `/* Simple Black & White Design */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #000;
  color: #fff;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.container {
  text-align: center;
  max-width: 600px;
}

h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #fff;
  letter-spacing: -0.02em;
}

p {
  font-family: 'Inter', sans-serif;
  font-size: 1.125rem;
  font-weight: 400;
  color: #ccc;
  margin-bottom: 2rem;
  line-height: 1.6;
}

button {
  font-family: 'Inter', sans-serif;
  background: #fff;
  color: #000;
  border: 2px solid #fff;
  padding: 0.875rem 2.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  letter-spacing: 0.02em;
  border-radius: 4px;
}

button:hover {
  background: #000;
  color: #fff;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  h1 {
    font-size: 2.25rem;
  }
  
  p {
    font-size: 1rem;
  }
  
  button {
    padding: 0.75rem 2rem;
  }
}`;



    const defaultJS = `// Simple button interaction
document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('myButton');
  
  if (button) {
    button.addEventListener('click', () => {
      alert('Hello! You clicked the button.');
      console.log('Button clicked!');
    });
  }
  
  console.log('Welcome to LiveMarkup!');
});`;

    // Set default content (don't clear cache - this is for new users)
    this.editors.html.setValue(defaultHTML);
    this.editors.css.setValue(defaultCSS);
    this.editors.js.setValue(defaultJS);

    this.updatePreview();
    this.showStatus('Default content loaded');
  }

  newProject() {
    if (confirm('Are you sure you want to create a new project? Unsaved changes will be lost.')) {
      this.projectData = {
        title: 'Untitled Project',
        html: '',
        css: '',
        js: ''
      };

      document.getElementById('projectTitle').value = this.projectData.title;
      this.editors.html.setValue('');
      this.editors.css.setValue('');
      this.editors.js.setValue('');

      this.compile();
      this.showStatus('New project created');
    }
  }

  shareProject() {
    const shareData = {
      title: this.projectData.title,
      html: this.editors.html.getValue(),
      css: this.editors.css.getValue(),
      js: this.editors.js.getValue()
    };

    const shareUrl = btoa(JSON.stringify(shareData));
    const fullUrl = `${window.location.origin}${window.location.pathname}?share=${shareUrl}`;

    // Copy to clipboard
    navigator.clipboard.writeText(fullUrl).then(() => {
      this.showStatus('Share link copied to clipboard!');
    }).catch(() => {
      prompt('Share link:', fullUrl);
    });
  }

  setPreviewMode(mode) {
    this.previewMode = mode;

    // Update buttons
    document.querySelectorAll('.preview-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.closest('.preview-btn').classList.add('active');

    // Update iframe size
    const iframe = document.getElementById('preview');
    const container = document.querySelector('.preview-container');

    switch (mode) {
      case 'mobile':
        iframe.style.maxWidth = '375px';
        iframe.style.margin = '0 auto';
        break;
      case 'tablet':
        iframe.style.maxWidth = '768px';
        iframe.style.margin = '0 auto';
        break;
      default:
        iframe.style.maxWidth = '100%';
        iframe.style.margin = '0';
    }
  }

  refreshPreview() {
    this.compile();
    this.showStatus('Preview refreshed');
  }

  openInNewTab() {
    const html = this.editors.html.getValue();
    const css = this.editors.css.getValue();
    const js = this.editors.js.getValue();

    // Create the HTML content using string concatenation
    const htmlContent = '<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <style>' + css + '</style>\n  </head>\n  <body>\n    ' + html + '\n    <script>' + js + '</script>\n  </body>\n</html>';

    const newWindow = window.open('', '_blank');
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  }

  changeTheme(theme) {
    Object.keys(this.editors).forEach(key => {
      this.editors[key].setOption('theme', theme);
    });
    this.showStatus(`Theme changed to ${theme}`);
  }

  changeFontSize(size) {
    const fontSize = `${size}px`;
    document.querySelectorAll('.CodeMirror').forEach(cm => {
      cm.style.fontSize = fontSize;
    });
    this.showStatus(`Font size changed to ${size}px`);
  }

  setupResizeHandle() {
    const handle = document.getElementById('resize-handle');
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;

    const applySplit = (newLeftWidth) => {
      const container = leftPanel.parentElement;
      const containerWidth = container.offsetWidth;
      const handleWidth = handle.offsetWidth || 8;
      const viewportWidth = window.innerWidth;
      const minPx = viewportWidth <= 767 ? 200 : (viewportWidth <= 1024 ? 280 : 350);
      const maxLeftWidth = containerWidth - minPx - handleWidth;

      if (newLeftWidth >= minPx && newLeftWidth <= maxLeftWidth) {
        const percentage = (newLeftWidth / containerWidth) * 100;
        document.documentElement.style.setProperty('--panel-left-width', `${percentage}%`);
        document.documentElement.style.setProperty('--panel-right-width', `${100 - percentage}%`);
        leftPanel.style.flex = '';
        rightPanel.style.flex = '';
        
        // Trigger editor refresh to ensure proper resizing
        Object.values(this.editors).forEach(editor => {
          if (editor) editor.refresh();
        });
      }
    };

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startLeftWidth = leftPanel.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const deltaX = e.clientX - startX;
      const newLeftWidth = startLeftWidth + deltaX;

      applySplit(newLeftWidth);
      e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = '';
      }
    });

    // Handle window resize to maintain proportions
    window.addEventListener('resize', () => {
      if (!isResizing) {
        const currentLeftWidth = leftPanel.offsetWidth;
        applySplit(currentLeftWidth);
      }
    });
  }

  updateCharacterCount() {
    const totalChars =
      this.editors.html.getValue().length +
      this.editors.css.getValue().length +
      this.editors.js.getValue().length;

    document.getElementById('char-count').textContent = `${totalChars.toLocaleString()} characters`;
  }

  debounceSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveProject();
    }, 1000);
  }

  showStatus(message) {
    const footer = document.querySelector('.footer-left span');
    const originalText = footer.textContent;
    footer.textContent = message;
    footer.style.color = 'var(--accent-color)';

    setTimeout(() => {
      footer.textContent = originalText;
      footer.style.color = 'var(--success-color)';
    }, 2000);
  }

  // Load shared project from URL
  loadSharedProject() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareData = urlParams.get('share');

    if (shareData) {
      try {
        const project = JSON.parse(atob(shareData));
        this.projectData = project;

        document.getElementById('projectTitle').value = project.title;
        this.editors.html.setValue(project.html);
        this.editors.css.setValue(project.css);
        this.editors.js.setValue(project.js);

        this.compile();
        this.showStatus('Shared project loaded');
      } catch (error) {
        console.error('Error loading shared project:', error);
      }
    }
  }

  // Code formatting functions
  formatCode() {
    const currentPanel = this.currentPanel;
    const editor = this.editors[currentPanel];
    let code = editor.getValue();

    try {
      switch (currentPanel) {
        case 'html':
          code = this.formatHTML(code);
          break;
        case 'css':
          code = this.formatCSS(code);
          break;
        case 'js':
          code = this.formatJavaScript(code);
          break;
      }

      editor.setValue(code);
      this.showStatus('Code formatted');
    } catch (error) {
      this.showStatus('Error formatting code');
    }
  }

  minifyCode() {
    const currentPanel = this.currentPanel;
    const editor = this.editors[currentPanel];
    let code = editor.getValue();

    try {
      switch (currentPanel) {
        case 'html':
          code = this.minifyHTML(code);
          break;
        case 'css':
          code = this.minifyCSS(code);
          break;
        case 'js':
          code = this.minifyJavaScript(code);
          break;
      }

      editor.setValue(code);
      this.showStatus('Code minified');
    } catch (error) {
      this.showStatus('Error minifying code');
    }
  }

  // HTML Formatter
  formatHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    return this.formatHTMLNode(div, 0).innerHTML.trim();
  }

  formatHTMLNode(node, indent) {
    const indentStr = '  '.repeat(indent);

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim() ? node.textContent : '';
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      let html = indentStr + '<' + node.tagName.toLowerCase();

      // Add attributes
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        html += ' ' + attr.name + '="' + attr.value + '"';
      }

      html += '>';

      // Add children
      const children = Array.from(node.childNodes);
      if (children.length > 0) {
        html += '\n';
        children.forEach(child => {
          const childHTML = this.formatHTMLNode(child, indent + 1);
          if (childHTML) {
            html += childHTML + '\n';
          }
        });
        html += indentStr;
      }

      html += '</' + node.tagName.toLowerCase() + '>';
      return { innerHTML: html };
    }

    return '';
  }

  // CSS Formatter
  formatCSS(css) {
    return css
      .replace(/\s*{\s*/g, ' {\n  ')
      .replace(/;\s*/g, ';\n  ')
      .replace(/\s*}\s*/g, '\n}\n')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  // JavaScript Formatter (Basic)
  formatJavaScript(js) {
    // Simple formatting - add proper indentation
    let formatted = js;
    let indentLevel = 0;
    const lines = formatted.split('\n');
    const result = [];

    for (let line of lines) {
      const trimmed = line.trim();

      // Decrease indent for closing braces
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add current line with proper indentation
      if (trimmed) {
        result.push('  '.repeat(indentLevel) + trimmed);
      }

      // Increase indent for opening braces
      if (trimmed.endsWith('{')) {
        indentLevel++;
      }
    }

    return result.join('\n');
  }

  // HTML Minifier
  minifyHTML(html) {
    return html
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
  }

  // CSS Minifier
  minifyCSS(css) {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/;\s*}/g, '}')
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .replace(/:\s*/g, ':')
      .replace(/;\s*/g, ';')
      .trim();
  }

  // JavaScript Minifier
  minifyJavaScript(js) {
    if (!js || typeof js !== 'string') return js;

    try {
      // Basic minification with error handling
      return js
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*/g, ';') // Clean up semicolons
        .replace(/\s*{\s*/g, '{') // Clean up braces
        .replace(/\s*}\s*/g, '}') // Clean up closing braces
        .replace(/\s*=\s*/g, '=') // Clean up equals
        .replace(/\s*,\s*/g, ',') // Clean up commas
        .trim();
    } catch (error) {
      console.error('Error minifying JavaScript:', error.message);
      return js; // Return original code if minification fails
    }
  }

  // Console functionality
  setupConsoleListener() {
    // Listen for messages from the iframe
    window.addEventListener('message', (event) => {
      if (event.data.type === 'console') {
        // Send to both consoles: left panel and bottom panel
        this.addConsoleMessage('left', event.data.level, event.data.message);
        this.addConsoleMessage('bottom', event.data.level, event.data.message);
      }
    });
  }

  addConsoleMessage(location, level, message) {
    const outputId = location === 'left' ? 'console-output' : 'console-output-bottom';
    const output = document.getElementById(outputId);

    if (!output) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `console-message ${level}`;
    messageDiv.textContent = message;

    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'console-timestamp';
    timeSpan.textContent = `[${timestamp}] `;
    timeSpan.style.color = '#888';
    timeSpan.style.fontSize = '11px';

    messageDiv.insertBefore(timeSpan, messageDiv.firstChild);

    output.appendChild(messageDiv);

    // Auto-scroll to bottom
    output.scrollTop = output.scrollHeight;

    // Remove old messages if too many
    const messages = output.querySelectorAll('.console-message');
    if (messages.length > 100) {
      output.removeChild(messages[0]);
    }
  }

  clearConsole() {
    const consoleOutput = document.getElementById('console-output');
    consoleOutput.innerHTML = '<div class="console-welcome">Console output will appear here...</div>';
  }

  toggleConsole() {
    const consolePanel = document.getElementById('console-panel');
    const consoleToggle = document.getElementById('console-toggle');
    const consoleToggleBtn = document.getElementById('console-toggle-btn');

    if (consolePanel.style.display === 'none' || consolePanel.style.display === '') {
      consolePanel.style.display = 'block';
      consoleToggle.classList.add('active');
      consoleToggleBtn.classList.add('active');
      this.showStatus('Console opened');
    } else {
      consolePanel.style.display = 'none';
      consoleToggle.classList.remove('active');
      consoleToggleBtn.classList.remove('active');
      this.showStatus('Console closed');
    }
  }

  toggleConsolePanel() {
    const consolePanel = document.getElementById('console-panel-bottom');
    const consoleToggleBtn = document.querySelector('.console-toggle-footer');

    if (consolePanel.classList.contains('show')) {
      consolePanel.classList.remove('show');
      consoleToggleBtn.classList.remove('active');
      this.showStatus('Console closed');
    } else {
      consolePanel.classList.add('show');
      consoleToggleBtn.classList.add('active');
      this.showStatus('Console opened');
    }
  }

  clearConsoleBottom() {
    const consoleOutput = document.getElementById('console-output-bottom');
    consoleOutput.innerHTML = '<div class="console-welcome">Console output will appear here...</div>';
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.showStatus('Entered fullscreen mode');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        this.showStatus('Exited fullscreen mode');
      }
    }
  }

  toggleZenMode() {
    document.body.classList.toggle('zen-mode');
    const isZenMode = document.body.classList.contains('zen-mode');

    if (isZenMode) {
      // Hide header and footer for zen mode
      document.querySelector('.header').style.display = 'none';
      document.querySelector('.footer').style.display = 'none';
      document.querySelector('.main-container').style.top = '';
      document.querySelector('.main-container').style.bottom = '';
      this.showStatus('Zen mode enabled - Press ESC to exit');

      // Add ESC key listener for zen mode
      this.zenModeKeyListener = (e) => {
        if (e.key === 'Escape') {
          this.toggleZenMode();
        }
      };
      document.addEventListener('keydown', this.zenModeKeyListener);
    } else {
      // Show header and footer
      document.querySelector('.header').style.display = 'flex';
      document.querySelector('.footer').style.display = 'flex';
      document.querySelector('.main-container').style.top = '';
      document.querySelector('.main-container').style.bottom = '';
      this.showStatus('Zen mode disabled');

      // Remove ESC key listener
      if (this.zenModeKeyListener) {
        document.removeEventListener('keydown', this.zenModeKeyListener);
        this.zenModeKeyListener = null;
      }
    }

    // Announce to screen readers
    this.announceToScreenReader(isZenMode ? 'Zen mode enabled' : 'Zen mode disabled');
  }

  loadSettings() {
    const savedSettings = localStorage.getItem('liveMarkup-settings');
    if (savedSettings) {
      this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
    }
  }

  saveSettings() {
    localStorage.setItem('liveMarkup-settings', JSON.stringify(this.settings));
  }

  applySettings() {
    // Sync UI with settings
    const getEl = (id) => document.getElementById(id);
    if (getEl('editor-theme')) getEl('editor-theme').value = this.settings.theme;
    if (getEl('font-size')) getEl('font-size').value = this.settings.fontSize;
    if (getEl('font-size-value')) getEl('font-size-value').textContent = this.settings.fontSize + 'px';
    if (getEl('tab-size')) getEl('tab-size').value = this.settings.tabSize;
    if (getEl('layout-mode')) getEl('layout-mode').value = this.settings.layout;
    if (getEl('auto-save')) getEl('auto-save').checked = this.settings.autoSave;
    if (getEl('live-preview')) getEl('live-preview').checked = this.settings.livePreview;
    if (getEl('word-wrap')) getEl('word-wrap').checked = this.settings.wordWrap;
    if (getEl('line-numbers')) getEl('line-numbers').checked = this.settings.lineNumbers;
    if (getEl('auto-complete')) getEl('auto-complete').checked = this.settings.autoComplete;

    // Apply to editors
    Object.keys(this.editors).forEach(key => {
      const editor = this.editors[key];
      if (!editor) return;

      editor.setOption('theme', this.settings.theme);
      editor.setOption('tabSize', this.settings.tabSize);
      editor.setOption('indentUnit', this.settings.tabSize);
      editor.setOption('lineWrapping', this.settings.wordWrap);
      editor.setOption('lineNumbers', this.settings.lineNumbers);

      // Auto-complete setup for each editor
      if (this.settings.autoComplete) {
        if (!editor._hintListener) {
          editor._hintListener = (cm, change) => {
            if (change.origin !== '+input' ||
              change.text[0] === ' ' ||
              change.text[0] === ';' ||
              change.text[0] === '}' ||
              change.text[0] === '>') {
              return;
            }
            cm.showHint({ completeSingle: false });
          };
          editor.on('inputRead', editor._hintListener);
        }
      } else if (editor._hintListener) {
        editor.off('inputRead', editor._hintListener);
        delete editor._hintListener;
      }

      const wrapper = editor.getWrapperElement();
      if (wrapper) wrapper.style.fontSize = this.settings.fontSize + 'px';
    });

    this.changeLayout(this.settings.layout);
    this.saveSettings();
  }

  toggleSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.toggle('active');
    }
  }

  changeLayout(mode) {
    const editorLayout = document.querySelector('.editor-layout');
    const resizeHandle = document.querySelector('.resize-handle');
    if (!editorLayout || !resizeHandle) return;

    if (mode === 'vertical') {
      editorLayout.style.flexDirection = 'column';
      resizeHandle.style.width = '100%';
      resizeHandle.style.height = '8px';
      resizeHandle.style.cursor = 'row-resize';
      document.documentElement.style.setProperty('--panel-left-width', '100%');
      document.documentElement.style.setProperty('--panel-right-width', '100%');
    } else {
      editorLayout.style.flexDirection = 'row';
      resizeHandle.style.width = '8px';
      resizeHandle.style.height = '100%';
      resizeHandle.style.cursor = 'col-resize';
    }

    // Refresh layout to ensure editors resize correctly
    this.refreshLayout();
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveProject();
      }

      // Ctrl/Cmd + N: New project
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.newProject();
      }

      // Ctrl/Cmd + E: Export
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        this.exportProject();
      }

      // Ctrl/Cmd + I: Import
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        this.importProject();
      }

      // Ctrl/Cmd + Enter: Run/Compile
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.compile();
      }

      // F11: Fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreen();
      }

      // Ctrl/Cmd + Shift + Z: Zen mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        this.toggleZenMode();
      }

      // Ctrl/Cmd + Shift + C: Toggle console
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        this.toggleConsole();
      }

      // Ctrl/Cmd + Shift + S: Settings
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.toggleSettings();
      }

      // Ctrl/Cmd + 1/2/3: Switch tabs
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '3') {
        e.preventDefault();
        const panelIndex = parseInt(e.key) - 1;
        const panels = ['html', 'css', 'js'];
        if (panels[panelIndex]) {
          this.switchPanel(panels[panelIndex]);
        }
      }

      // Ctrl/Cmd + /: Toggle comment
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        this.toggleComment();
      }

      // Ctrl/Cmd + D: Duplicate line
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        this.duplicateLine();
      }
    });
  }

  switchPanel(panelName) {
    // Remove active class from all tabs and panels
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.editor-panel').forEach(panel => panel.classList.remove('active'));

    // Add active class to selected tab and panel
    document.querySelector(`[data-panel="${panelName}"]`).classList.add('active');
    document.getElementById(`${panelName}-panel`).classList.add('active');

    this.currentPanel = panelName;
  }

  toggleComment() {
    const editor = this.editors[this.currentPanel];
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      // Uncomment
      editor.replaceRange(
        line.replace(/^\s*\/\/\s?/, '').replace(/^\s*\/\*\s?/, '').replace(/^\s*\*\s?/, '').replace(/\s*\*\/\s*$/, ''),
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    } else {
      // Comment
      editor.replaceRange(
        `// ${line}`,
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: line.length }
      );
    }
  }

  duplicateLine() {
    const editor = this.editors[this.currentPanel];
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);

    editor.replaceRange(`\n${line}`, { line: cursor.line + 1, ch: 0 });
    editor.setCursor({ line: cursor.line + 1, ch: cursor.ch });
  }

  setupMobileOptimizations() {
    // Detect mobile devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isMobile || isTouchDevice) {
      this.setupTouchOptimizations();
      this.setupPerformanceOptimizations();
      this.setupMobileUI();
    }

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.refreshLayout();
      }, 100);
    });

    // Handle viewport changes
    window.addEventListener('resize', () => {
      this.debounce(() => {
        this.refreshLayout();
      }, 250);
    });

    // Handle system preferences
    this.setupSystemPreferences();

    // Handle accessibility
    this.setupAccessibilityFeatures();

    // Handle special display modes
    this.setupDisplayModes();
  }

  setupTouchOptimizations() {
    // Improve touch scrolling for CodeMirror
    Object.keys(this.editors).forEach(key => {
      const editor = this.editors[key];

      // Better touch scrolling
      editor.getScrollerElement().style.touchAction = 'pan-y';

      // Prevent zoom on double tap
      editor.getScrollerElement().addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      });

      // Handle long press for context menu
      let pressTimer;
      editor.getScrollerElement().addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => {
          // Show context menu or handle long press
          this.showMobileContextMenu(e);
        }, 500);
      });

      editor.getScrollerElement().addEventListener('touchend', () => {
        clearTimeout(pressTimer);
      });
    });

    // Improve resize handle for touch
    const resizeHandle = document.getElementById('resize-handle');
    if (resizeHandle) {
      let isResizing = false;
      let startX = 0;
      let startLeftWidth = 0;

      const leftPanel = document.querySelector('.left-panel');
      const rightPanel = document.querySelector('.right-panel');

      const applySplit = (newLeftWidth) => {
        const container = leftPanel.parentElement;
        const containerWidth = container.offsetWidth;
        const handleWidth = resizeHandle.offsetWidth || 8;
        const viewportWidth = window.innerWidth;
        const minPx = viewportWidth <= 767 ? 200 : (viewportWidth <= 1024 ? 280 : 350);
        const maxLeftWidth = containerWidth - minPx - handleWidth;

        if (newLeftWidth >= minPx && newLeftWidth <= maxLeftWidth) {
          const percentage = (newLeftWidth / containerWidth) * 100;
          document.documentElement.style.setProperty('--panel-left-width', `${percentage}%`);
          document.documentElement.style.setProperty('--panel-right-width', `${100 - percentage}%`);
          leftPanel.style.flex = '';
          rightPanel.style.flex = '';
          
          // Trigger editor refresh
          Object.values(window.codePenClone.editors).forEach(editor => {
            if (editor) editor.refresh();
          });
        }
      };

      resizeHandle.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length === 0) return;
        isResizing = true;
        startX = e.touches[0].clientX;
        startLeftWidth = leftPanel.offsetWidth;
        e.preventDefault();
      }, { passive: false });

      resizeHandle.addEventListener('touchmove', (e) => {
        if (!isResizing) return;
        if (!e.touches || e.touches.length === 0) return;
        const deltaX = e.touches[0].clientX - startX;
        const newLeftWidth = startLeftWidth + deltaX;
        applySplit(newLeftWidth);
        e.preventDefault();
      }, { passive: false });

      resizeHandle.addEventListener('touchend', () => {
        isResizing = false;
      });
    }
  }

  setupPerformanceOptimizations() {
    // Reduce compilation frequency on mobile
    let compileTimeout;
    const originalCompile = this.compile.bind(this);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    this.compile = function () {
      clearTimeout(compileTimeout);
      compileTimeout = setTimeout(originalCompile, isMobile ? 500 : 200);
    };

    // Optimize console updates
    const originalAddConsoleMessage = this.addConsoleMessage.bind(this);
    let consoleBuffer = [];
    let consoleTimeout;

    this.addConsoleMessage = function (location, level, message) {
      consoleBuffer.push({ location, level, message });

      clearTimeout(consoleTimeout);
      consoleTimeout = setTimeout(() => {
        consoleBuffer.forEach(item => originalAddConsoleMessage(item.location, item.level, item.message));
        consoleBuffer = [];
      }, 100);
    };
  }

  setupMobileUI() {
    // Add mobile-specific controls
    const header = document.querySelector('.header');
    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.innerHTML = `
      <button class="mobile-menu-btn" onclick="toggleMobileMenu()">
        <i class="fas fa-bars"></i>
      </button>
    `;

    if (window.innerWidth <= 768) {
      header.insertBefore(mobileMenu, header.firstChild);
    }

    // Add swipe gestures for tab switching
    let touchStartX = 0;
    let touchEndX = 0;

    const tabsContainer = document.querySelector('.tabs');
    tabsContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    tabsContainer.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipeGesture();
    });

    this.touchStartX = touchStartX;
    this.touchEndX = touchEndX;
  }

  handleSwipeGesture() {
    const swipeThreshold = 50;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > swipeThreshold) {
      const panels = ['html', 'css', 'js'];
      const currentIndex = panels.indexOf(this.currentPanel);

      if (diff > 0 && currentIndex < panels.length - 1) {
        // Swipe left - next tab
        this.switchPanel(panels[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe right - previous tab
        this.switchPanel(panels[currentIndex - 1]);
      }
    }
  }

  showMobileContextMenu(event) {
    // Simple context menu for mobile
    const menu = document.createElement('div');
    menu.className = 'mobile-context-menu';
    menu.innerHTML = `
      <button onclick="window.codePenClone.duplicateLine()">Duplicate Line</button>
      <button onclick="window.codePenClone.toggleComment()">Toggle Comment</button>
      <button onclick="window.codePenClone.formatCode()">Format Code</button>
    `;

    menu.style.position = 'fixed';
    menu.style.left = event.touches[0].clientX + 'px';
    menu.style.top = event.touches[0].clientY + 'px';

    document.body.appendChild(menu);

    // Remove menu after selection or timeout
    setTimeout(() => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
    }, 3000);

    // Close menu on tap outside
    document.addEventListener('touchstart', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        document.body.removeChild(menu);
        document.removeEventListener('touchstart', closeMenu);
      }
    });
  }

  refreshLayout() {
    // Refresh CodeMirror layouts
    Object.keys(this.editors).forEach(key => {
      this.editors[key].refresh();
    });

    // Adjust panel heights for mobile
    if (window.innerWidth <= 768) {
      const leftPanel = document.querySelector('.left-panel');
      const rightPanel = document.querySelector('.right-panel');
      const availableHeight = window.innerHeight -
        document.querySelector('.header').offsetHeight -
        document.querySelector('.footer').offsetHeight;

      if (leftPanel && rightPanel) {
        leftPanel.style.height = '40vh';
        rightPanel.style.height = '40vh';
      }
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  setupSystemPreferences() {
    // Handle color scheme preferences
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

    const updateColorScheme = () => {
      if (prefersDark.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else if (prefersLight.matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    };

    prefersDark.addListener(updateColorScheme);
    prefersLight.addListener(updateColorScheme);
    updateColorScheme();

    // Handle reduced motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionSettings = () => {
      if (prefersReducedMotion.matches) {
        document.documentElement.setAttribute('data-reduced-motion', 'true');
      } else {
        document.documentElement.removeAttribute('data-reduced-motion');
      }
    };

    prefersReducedMotion.addListener(updateMotionSettings);
    updateMotionSettings();

    // Handle high contrast preferences
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    const updateContrastSettings = () => {
      if (prefersHighContrast.matches) {
        document.documentElement.setAttribute('data-high-contrast', 'true');
      } else {
        document.documentElement.removeAttribute('data-high-contrast');
      }
    };

    prefersHighContrast.addListener(updateContrastSettings);
    updateContrastSettings();
  }

  setupAccessibilityFeatures() {
    // Add ARIA labels to interactive elements
    document.querySelectorAll('.btn').forEach((btn, index) => {
      if (!btn.getAttribute('aria-label')) {
        const text = btn.textContent.trim();
        if (text) {
          btn.setAttribute('aria-label', text);
        } else {
          const icon = btn.querySelector('i');
          if (icon) {
            btn.setAttribute('aria-label', `Button ${index + 1}`);
          }
        }
      }
    });

    document.querySelectorAll('.tab').forEach(tab => {
      if (!tab.getAttribute('aria-label')) {
        const panelName = tab.dataset.panel;
        tab.setAttribute('aria-label', `${panelName.toUpperCase()} editor tab`);
      }
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', tab.classList.contains('active'));
    });

    document.querySelectorAll('.preview-btn').forEach(btn => {
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', 'Preview control button');
      }
    });

    // Add keyboard navigation for tabs
    document.querySelectorAll('.tab').forEach((tab, index) => {
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const tabs = Array.from(document.querySelectorAll('.tab'));
          const currentIndex = tabs.indexOf(tab);
          let newIndex;

          if (e.key === 'ArrowLeft') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          } else {
            newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          }

          tabs[newIndex].click();
          tabs[newIndex].focus();
        }
      });
    });

    // Add screen reader announcements
    this.announceToScreenReader = (message) => {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = message;

      document.body.appendChild(announcement);
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    };
  }

  setupDisplayModes() {
    // Handle print mode
    const beforePrint = () => {
      document.body.classList.add('printing');
      this.showStatus('Preparing for printing...');
    };

    const afterPrint = () => {
      document.body.classList.remove('printing');
      this.showStatus('Print mode ended');
    };

    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);

    // Handle projection mode
    const handleProjectionMode = () => {
      if (window.matchMedia('(projection)').matches) {
        document.body.classList.add('projection-mode');
        this.showStatus('Projection mode activated');
      } else {
        document.body.classList.remove('projection-mode');
      }
    };

    const projectionQuery = window.matchMedia('(projection)');
    projectionQuery.addListener(handleProjectionMode);
    handleProjectionMode();

    // Handle e-ink displays (slow update displays)
    if (window.matchMedia('(update: slow)').matches) {
      document.body.classList.add('e-ink-display');
      this.showStatus('E-ink display mode: animations disabled');
    }

    // Handle ultra-wide displays
    const handleUltraWide = () => {
      if (window.matchMedia('(min-aspect-ratio: 21/9)').matches) {
        document.body.classList.add('ultra-wide');
        this.showStatus('Ultra-wide display mode');
      } else {
        document.body.classList.remove('ultra-wide');
      }
    };

    const ultraWideQuery = window.matchMedia('(min-aspect-ratio: 21/9)');
    ultraWideQuery.addListener(handleUltraWide);
    handleUltraWide();

    // Handle square displays
    const handleSquareDisplay = () => {
      if (window.matchMedia('(max-aspect-ratio: 1/1)').matches) {
        document.body.classList.add('square-display');
        this.showStatus('Square display mode');
      } else {
        document.body.classList.remove('square-display');
      }
    };

    const squareQuery = window.matchMedia('(max-aspect-ratio: 1/1)');
    squareQuery.addListener(handleSquareDisplay);
    handleSquareDisplay();
  }

  // Enhanced layout refresh for all display modes
  refreshLayout() {
    // Refresh CodeMirror layouts
    Object.keys(this.editors).forEach(key => {
      this.editors[key].refresh();
    });

    // Handle different screen sizes and orientations
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;

    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');

    const bucket = width <= 767 ? 'mobile' : (width <= 1024 ? 'tablet' : 'desktop');
    if (this.lastWidthBucket !== bucket) {
      if (leftPanel) {
        leftPanel.style.flex = '';
        leftPanel.style.width = '';
        leftPanel.style.height = '';
      }
      if (rightPanel) {
        rightPanel.style.flex = '';
        rightPanel.style.width = '';
        rightPanel.style.height = '';
      }
      document.documentElement.style.setProperty('--panel-left-width', '50%');
      document.documentElement.style.setProperty('--panel-right-width', '50%');
      this.lastWidthBucket = bucket;
    }

    // Handle ultra-wide displays
    // Keep editor full-width; do not constrain main container width.
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
      mainContainer.style.maxWidth = '';
      mainContainer.style.margin = '';
    }

    // Handle square displays
    if (aspectRatio < 1.2 && aspectRatio > 0.8) {
      document.body.classList.add('square-display');
    } else {
      document.body.classList.remove('square-display');
    }

    // Announce layout changes for screen readers
    const layoutType = this.getLayoutType();
    if (this.lastLayoutType !== layoutType) {
      this.announceToScreenReader(`Layout changed to ${layoutType}`);
      this.lastLayoutType = layoutType;
    }
  }

  getLayoutType() {
    const width = window.innerWidth;
    const aspectRatio = width / window.innerHeight;

    if (width <= 280) return 'tiny mobile';
    if (width <= 480) return 'small mobile';
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    if (width <= 1366) return 'large tablet';
    if (width <= 1920) return 'desktop';
    if (width <= 2560) return 'large desktop';
    if (width <= 3840) return '4K display';

    if (aspectRatio > 2) return 'ultra-wide';
    if (aspectRatio < 1.2 && aspectRatio > 0.8) return 'square';

    return 'standard';
  }
}

// Global functions for HTML onclick handlers
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-menu-overlay');
  if (menu && overlay) {
    menu.classList.toggle('active');
    overlay.classList.toggle('show');
  }
}

function toggleZenMode() {
  window.liveMarkup.toggleZenMode();
}

function toggleConsolePanel() {
  window.liveMarkup.toggleConsolePanel();
}

function clearConsole() {
  window.liveMarkup.clearConsole();
}

function clearConsoleBottom() {
  window.liveMarkup.clearConsoleBottom();
}

function refreshPreview() {
  window.liveMarkup.updatePreview();
}

function openInNewTab() {
  const preview = document.getElementById('preview');
  const previewContent = preview.srcdoc;

  const newWindow = window.open();
  newWindow.document.write(previewContent);
  newWindow.document.close();
}

function newProject() {
  window.liveMarkup.newProject();
}

function saveProject() {
  window.liveMarkup.saveProject();
}

function exportProject() {
  window.liveMarkup.exportProject();
}

function importProject() {
  window.liveMarkup.importProject();
}

function shareProject() {
  window.liveMarkup.shareProject();
}

function toggleFullscreen() {
  window.liveMarkup.toggleFullscreen();
}

function toggleSettings() {
  window.liveMarkup.toggleSettings();
}

function setPreviewMode(mode) {
  window.liveMarkup.setPreviewMode(mode);
}




function scrollToTop() {
  window.liveMarkup.scrollToTop();
}

// Initialize the editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.liveMarkup = new LiveMarkup();
});
