(function(window, document) {
  'use strict';

  // Configuration
  const AUTHENTIK_BASE_URL = window.AUTHENTIK_BASE_URL || 'https://web2.zendwise.work';

  // Default themes (simplified versions for standalone use)
  const DEFAULT_THEMES = {
    minimal: {
      container: 'max-w-2xl mx-auto p-8 bg-white border border-gray-200 rounded-xl shadow-lg',
      header: 'text-3xl font-light text-gray-900 mb-8',
      field: 'mb-6',
      label: 'block text-sm font-medium text-gray-700 mb-2',
      input: 'w-full px-4 py-3 h-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200',
      button: 'w-full bg-gray-900 text-white py-3 px-6 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium',
      textarea: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-vertical min-h-[100px]',
      select: 'w-full px-4 py-3 h-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white',
      checkbox: 'w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2',
      radio: 'w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2',
      background: 'authentik-minimal-bg'
    },
    modern: {
      container: 'max-w-2xl mx-auto p-8 bg-white/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl',
      header: 'text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-8 tracking-tight',
      field: 'mb-6',
      label: 'block text-sm font-semibold text-gray-800 mb-3 tracking-wide',
      input: 'w-full px-4 py-3 h-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white/80',
      button: 'w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl hover:scale-105 transition-all duration-300 font-semibold shadow-xl',
      textarea: 'w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 resize-vertical min-h-[100px] bg-white/80',
      select: 'w-full px-4 py-3 h-12 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 bg-white/80',
      checkbox: 'w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2',
      radio: 'w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500 focus:ring-2',
      background: 'authentik-modern-bg'
    }
  };

  // Utility functions
  function createElement(tag, className, textContent) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  function makeRequest(url, options = {}) {
    return fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    });
  }

  // Comprehensive inline style application for better reliability
  function applyInlineThemeStyles(themeId, nodes) {
    if (!nodes) return;
    const { wrapper, container, title, form } = nodes;
    
    // Apply wrapper background first
    if (wrapper) {
      if (themeId === 'modern') {
        wrapper.style.background = 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #fff1f2 100%)';
        wrapper.style.padding = '40px';
        wrapper.style.borderRadius = '12px';
        wrapper.style.minHeight = '500px';
      } else {
        wrapper.style.background = '#f5f7fb';
        wrapper.style.padding = '40px';
        wrapper.style.borderRadius = '12px';
        wrapper.style.minHeight = '500px';
      }
    }
    
    if (themeId === 'modern') {
      if (container) {
        container.style.maxWidth = '42rem';
        container.style.marginLeft = 'auto';
        container.style.marginRight = 'auto';
        container.style.padding = '2rem';
        container.style.backgroundColor = 'rgba(255,255,255,0.9)';
        container.style.backdropFilter = 'blur(24px)';
        container.style.webkitBackdropFilter = 'blur(24px)';
        container.style.border = '1px solid rgba(255,255,255,0.2)';
        container.style.borderRadius = '1rem';
        container.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.25)';
      }
      if (title) {
        title.style.fontSize = '2.25rem';
        title.style.lineHeight = '2.5rem';
        title.style.fontWeight = '700';
        title.style.marginBottom = '2rem';
        title.style.backgroundImage = 'linear-gradient(to right, #2563eb, #9333ea, #db2777)';
        title.style.backgroundClip = 'text';
        title.style.webkitBackgroundClip = 'text';
        title.style.color = 'transparent';
        title.style.webkitTextFillColor = 'transparent';
        title.style.letterSpacing = '-0.025em';
      }
      // Style all form inputs for modern theme
      if (form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          input.style.width = '100%';
          input.style.padding = '0.75rem 1rem';
          input.style.border = '2px solid #e5e7eb';
          input.style.borderRadius = '0.75rem';
          input.style.fontSize = '1rem';
          input.style.transition = 'all 0.3s';
          input.style.backgroundColor = 'rgba(255,255,255,0.8)';
        });
        
        const buttons = form.querySelectorAll('button[type="submit"]');
        buttons.forEach(btn => {
          btn.style.width = '100%';
          btn.style.padding = '1rem 1.5rem';
          btn.style.background = 'linear-gradient(to right, #2563eb, #9333ea, #db2777)';
          btn.style.color = 'white';
          btn.style.borderRadius = '0.75rem';
          btn.style.fontWeight = '600';
          btn.style.fontSize = '1rem';
          btn.style.border = 'none';
          btn.style.cursor = 'pointer';
          btn.style.transition = 'transform 0.3s';
          btn.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
        });
      }
    } else {
      // Minimal theme inline styles
      if (container) {
        container.style.maxWidth = '42rem';
        container.style.marginLeft = 'auto';
        container.style.marginRight = 'auto';
        container.style.padding = '2rem';
        container.style.backgroundColor = '#ffffff';
        container.style.border = '1px solid #e5e7eb';
        container.style.borderRadius = '0.75rem';
        container.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
      }
      if (title) {
        title.style.fontSize = '1.875rem';
        title.style.fontWeight = '300';
        title.style.color = '#111827';
        title.style.marginBottom = '2rem';
      }
    }
  }

  function injectTailwindCSS() {
    // Check if Tailwind CSS is already loaded
    if (document.querySelector('script[src*="tailwindcss"]') || 
        document.querySelector('link[href*="tailwind"]') ||
        window.tailwind ||
        document.querySelector('#authentik-form-styles')) {
      return;
    }

    // Inject our comprehensive built-in styles (no external dependencies)
    injectBasicStyles();
  }

  function injectBasicStyles() {
    console.log('Injecting Authentik form styles');
    const styleElement = document.createElement('style');
    styleElement.id = 'authentik-form-styles';
    styleElement.textContent = `
      /* Reset and scope all styles with high specificity */
      .authentik-form-container { 
        font-family: system-ui, -apple-system, sans-serif !important; 
        box-sizing: border-box !important;
        min-height: 400px !important;
        display: block !important;
        padding: 20px !important;
      }
      .authentik-form-container * { 
        box-sizing: border-box !important; 
        margin: 0;
        padding: 0;
      }
      /* Page/background helpers - use higher specificity */
      .authentik-form-container.authentik-minimal-bg { 
        background: #f5f7fb !important; 
        border-radius: 8px !important;
      }
      .authentik-form-container.authentik-modern-bg { 
        background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #fff1f2 100%) !important;
        border-radius: 8px !important;
      }
      .max-w-2xl { max-width: 42rem; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      .p-8 { padding: 2rem; }
      .bg-white { background-color: #ffffff; }
      .border { border-width: 1px; }
      .border-gray-200 { border-color: #e5e7eb; }
      .rounded-xl { border-radius: 0.75rem; }
      .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .font-light { font-weight: 300; }
      .text-gray-900 { color: #111827; }
      .mb-8 { margin-bottom: 2rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .mb-2 { margin-bottom: 0.5rem; }
      .block { display: block; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .font-medium { font-weight: 500; }
      .text-gray-700 { color: #374151; }
      .w-full { width: 100%; }
      .px-4 { padding-left: 1rem; padding-right: 1rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .h-12 { height: 3rem; }
      .border-gray-300 { border-color: #d1d5db; }
      .rounded-lg { border-radius: 0.5rem; }
      .focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
      .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
      .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5); }
      .focus\\:border-blue-500:focus { border-color: #3b82f6; }
      .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .duration-200 { transition-duration: 200ms; }
      .bg-gray-900 { background-color: #111827; }
      .text-white { color: #ffffff; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .hover\\:bg-gray-800:hover { background-color: #1f2937; }
      .resize-vertical { resize: vertical; }
      .min-h-\\[100px\\] { min-height: 100px; }
      .space-x-2 > * + * { margin-left: 0.5rem; }
      .space-y-2 > * + * { margin-top: 0.5rem; }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
      .bg-green-100 { background-color: #dcfce7; }
      .border-green-400 { border-color: #4ade80; }
      .text-green-700 { color: #15803d; }
      .bg-red-100 { background-color: #fee2e2; }
      .border-red-400 { border-color: #f87171; }
      .text-red-700 { color: #b91c1c; }
      .p-4 { padding: 1rem; }
      .mb-4 { margin-bottom: 1rem; }
      .rounded-lg { border-radius: 0.5rem; }
      
      /* Modern theme specific styles with higher specificity */
      .authentik-form-container .bg-white\\/90 { background-color: rgba(255, 255, 255, 0.9) !important; }
      .authentik-form-container .backdrop-blur-xl { backdrop-filter: blur(24px) !important; -webkit-backdrop-filter: blur(24px) !important; }
      .authentik-form-container .border-white\\/20 { border-color: rgba(255, 255, 255, 0.2) !important; }
      .authentik-form-container .rounded-2xl { border-radius: 1rem !important; }
      .authentik-form-container .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; }
      .authentik-form-container .text-4xl { font-size: 2.25rem !important; line-height: 2.5rem !important; }
      .authentik-form-container .font-bold { font-weight: 700 !important; }
      .authentik-form-container .bg-gradient-to-r { background-image: linear-gradient(to right, #2563eb, #9333ea, #db2777) !important; }
      .authentik-form-container .from-blue-600 { background-image: linear-gradient(to right, #2563eb, #9333ea, #db2777) !important; }
      .authentik-form-container .via-purple-600 { background-image: linear-gradient(to right, #2563eb, #9333ea, #db2777) !important; }
      .authentik-form-container .to-pink-600 { background-image: linear-gradient(to right, #2563eb, #9333ea, #db2777) !important; }
      .authentik-form-container .bg-clip-text { background-clip: text !important; -webkit-background-clip: text !important; }
      .authentik-form-container .text-transparent { color: transparent !important; -webkit-text-fill-color: transparent !important; }
      .tracking-tight { letter-spacing: -0.025em; }
      .font-semibold { font-weight: 600; }
      .text-gray-800 { color: #1f2937; }
      .mb-3 { margin-bottom: 0.75rem; }
      .tracking-wide { letter-spacing: 0.025em; }
      .border-2 { border-width: 2px; }
      .rounded-xl { border-radius: 0.75rem; }
      .focus\\:ring-purple-500:focus { box-shadow: 0 0 0 2px rgba(147, 51, 234, 0.5); }
      .focus\\:border-transparent:focus { border-color: transparent; }
      .duration-300 { transition-duration: 300ms; }
      .bg-white\\/80 { background-color: rgba(255, 255, 255, 0.8); }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .hover\\:scale-105:hover { transform: scale(1.05); }
      .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
      
      /* Form-specific enhancements */
      .authentik-form-container input:focus,
      .authentik-form-container textarea:focus,
      .authentik-form-container select:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
        border-color: #3b82f6;
      }
      
      .authentik-form-container button:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
      }
    `;
    document.head.appendChild(styleElement);
  }

  // Ensure styles exist inside a ShadowRoot when used
  function ensureStylesInRoot(root) {
    if (!root || !root.appendChild) return;
    // Ensure head has the base styles first (so we can clone)
    let headStyle = document.getElementById('authentik-form-styles');
    if (!headStyle) {
      injectBasicStyles();
      headStyle = document.getElementById('authentik-form-styles');
    }
    // If the shadow root does not have the styles, clone into it
    if (root.querySelector && !root.querySelector('#authentik-form-styles') && headStyle) {
      root.appendChild(headStyle.cloneNode(true));
    }
  }

  // Form renderer class
  class AuthentikForm {
    constructor(containerId, formId, options = {}) {
      this.containerId = containerId;
      this.formId = formId;
      this.options = {
        theme: 'minimal',
        showTitle: true,
        showDescription: true,
        useShadowDom: false,
        onSuccess: null,
        onError: null,
        ...options
      };
      this.formData = {};
      this.container = null;
      this.form = null;

      this.init();
    }

    async init() {
      try {
        // Inject Tailwind CSS if not present
        injectTailwindCSS();

        // Get container element
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
          throw new Error(`Container with ID "${this.containerId}" not found`);
        }

        // Load form data
        await this.loadForm();
        
        // Render form
        this.render();
      } catch (error) {
        console.error('AuthentikForm initialization error:', error);
        this.showError('Failed to load form. Please try again later.');
      }
    }

    async loadForm() {
      console.log(`Loading form ${this.formId} from ${AUTHENTIK_BASE_URL}`);
      const response = await makeRequest(`${AUTHENTIK_BASE_URL}/api/public/forms/${this.formId}`);
      console.log('Form data loaded:', response);
      this.formData = response;
    }

    render() {
      // Setup rendering root. Use Shadow DOM only if explicitly enabled
      let shadow = null;
      if (this.options.useShadowDom && this.container.attachShadow) {
        shadow = this.container.shadowRoot || this.container.attachShadow({ mode: 'open' });
        ensureStylesInRoot(shadow);
      }
      this.root = shadow || this.container;
      // Clear previous content in the rendering root
      if (!shadow) {
        this.container.innerHTML = '';
      } else {
        while (this.root.firstChild) this.root.removeChild(this.root.firstChild);
      }

      // Parse form data
      const formElements = JSON.parse(this.formData.formData);
      const theme = this.parseTheme(this.formData.theme);
      const themeStyles = this.getThemeStyles(theme);

      // Create form container with wrapper
      const bgClass = themeStyles.background || '';
      const wrapper = createElement('div', `authentik-form-container ${bgClass}`.trim());
      const formContainer = createElement('div', themeStyles.container);
      
      // Add title if enabled
      let titleNode = null;
      if (this.options.showTitle && this.formData.title) {
        titleNode = createElement('h2', themeStyles.header);
        titleNode.textContent = this.formData.title;
        formContainer.appendChild(titleNode);
      }

      // Add description if enabled
      if (this.options.showDescription && this.formData.description) {
        const description = createElement('p', 'text-gray-600 mb-6');
        description.textContent = this.formData.description;
        formContainer.appendChild(description);
      }

      // Create form element
      this.form = createElement('form');
      this.form.onsubmit = (e) => this.handleSubmit(e);

      // Render form elements
      if (formElements.elements && Array.isArray(formElements.elements)) {
        formElements.elements.forEach(element => {
          const fieldElement = this.renderFormElement(element, themeStyles);
          if (fieldElement) {
            this.form.appendChild(fieldElement);
          }
        });
      }

      // Add submit button if not present
      const hasSubmitButton = formElements.elements?.some(el => el.type === 'submit-button');
      if (!hasSubmitButton) {
        const submitButton = createElement('button');
        submitButton.type = 'submit';
        submitButton.className = themeStyles.button;
        submitButton.textContent = 'Submit';
        
        const buttonContainer = createElement('div', themeStyles.field);
        buttonContainer.appendChild(submitButton);
        this.form.appendChild(buttonContainer);
      }

      formContainer.appendChild(this.form);
      wrapper.appendChild(formContainer);
      this.root.appendChild(wrapper);

      // Always apply inline styles for maximum reliability
      try {
        applyInlineThemeStyles((this.options.theme || 'minimal'), {
          wrapper: wrapper,
          container: formContainer,
          title: titleNode,
          form: this.form
        });
      } catch (err) {
        console.warn('Failed to apply inline styles:', err);
      }
    }

    parseTheme(themeString) {
      try {
        return JSON.parse(themeString);
      } catch (error) {
        console.warn('Failed to parse theme, using default:', error);
        return { id: 'minimal', name: 'Minimal' };
      }
    }

    getThemeStyles(theme) {
      const themeId = theme.id || 'minimal';
      const requestedTheme = this.options.theme || 'minimal';
      
      // Always prioritize the requested theme over the form's theme
      if (DEFAULT_THEMES[requestedTheme]) {
        console.log(`Using requested theme: "${requestedTheme}"`);
        return DEFAULT_THEMES[requestedTheme];
      }
      
      // If requested theme is not available, try the form's theme
      if (DEFAULT_THEMES[themeId]) {
        console.log(`Using form theme: "${themeId}"`);
        return DEFAULT_THEMES[themeId];
      }
      
      // Final fallback to minimal
      console.warn(`Theme "${themeId}" not supported, falling back to minimal`);
      return DEFAULT_THEMES.minimal;
    }

    renderFormElement(element, themeStyles) {
      if (!element || !element.type) return null;

      const fieldContainer = createElement('div', themeStyles.field);

      // Add label for most field types
      if (element.type !== 'submit-button' && element.type !== 'reset-button' && element.type !== 'spacer') {
        if (element.label) {
          const label = createElement('label', themeStyles.label);
          label.textContent = element.label;
          if (element.required) {
            const asterisk = document.createElement('span');
            asterisk.style.color = 'red';
            asterisk.textContent = '*';
            label.appendChild(asterisk);
          }
          fieldContainer.appendChild(label);
        }
      }

      // Render the input element
      const inputElement = this.createInputElement(element, themeStyles);
      if (inputElement) {
        fieldContainer.appendChild(inputElement);
      }

      // Add help text if present
      if (element.helpText) {
        const helpText = createElement('p', 'text-sm text-gray-500 mt-1');
        helpText.textContent = element.helpText;
        fieldContainer.appendChild(helpText);
      }

      return fieldContainer;
    }

    createInputElement(element, themeStyles) {
      const commonAttributes = {
        name: element.name,
        required: element.required || false,
        disabled: element.disabled || false,
        placeholder: element.placeholder || ''
      };

      let inputElement;

      switch (element.type) {
        case 'text-input':
          inputElement = createElement('input');
          inputElement.type = 'text';
          inputElement.className = themeStyles.input;
          break;

        case 'email-input':
          inputElement = createElement('input');
          inputElement.type = 'email';
          inputElement.className = themeStyles.input;
          break;

        case 'number-input':
          inputElement = createElement('input');
          inputElement.type = 'number';
          inputElement.className = themeStyles.input;
          if (element.validation?.min !== undefined) inputElement.min = element.validation.min;
          if (element.validation?.max !== undefined) inputElement.max = element.validation.max;
          break;

        case 'textarea':
          inputElement = createElement('textarea');
          inputElement.className = themeStyles.textarea;
          inputElement.rows = element.rows || 4;
          break;

        case 'select':
          inputElement = createElement('select');
          inputElement.className = themeStyles.select;
          
          // Add default option
          if (element.placeholder) {
            const defaultOption = createElement('option', '', element.placeholder);
            defaultOption.value = '';
            defaultOption.disabled = true;
            defaultOption.selected = true;
            inputElement.appendChild(defaultOption);
          }

          // Add options
          if (element.options && Array.isArray(element.options)) {
            element.options.forEach(option => {
              const optionElement = createElement('option');
              optionElement.textContent = option.label || option.value;
              optionElement.value = option.value;
              inputElement.appendChild(optionElement);
            });
          }
          break;

        case 'checkbox':
          const checkboxContainer = createElement('div', 'flex items-center space-x-2');
          inputElement = createElement('input');
          inputElement.type = 'checkbox';
          inputElement.className = themeStyles.checkbox;
          
          const checkboxLabel = createElement('label', 'text-gray-700');
          checkboxLabel.textContent = element.label || '';
          checkboxContainer.appendChild(inputElement);
          checkboxContainer.appendChild(checkboxLabel);
          return checkboxContainer;

        case 'radio':
          const radioContainer = createElement('div', 'space-y-2');
          if (element.options && Array.isArray(element.options)) {
            element.options.forEach(option => {
              const optionContainer = createElement('div', 'flex items-center space-x-2');
              const radioInput = createElement('input');
              radioInput.type = 'radio';
              radioInput.name = element.name;
              radioInput.value = option.value;
              radioInput.className = themeStyles.radio;
              
              const radioLabel = createElement('label', 'text-gray-700');
              radioLabel.textContent = option.label || option.value;
              optionContainer.appendChild(radioInput);
              optionContainer.appendChild(radioLabel);
              radioContainer.appendChild(optionContainer);
            });
          }
          return radioContainer;

        case 'datetime-picker':
          inputElement = createElement('input');
          inputElement.className = themeStyles.input;
          
          switch (element.dateTimeVariant) {
            case 'time-only':
              inputElement.type = 'time';
              break;
            case 'datetime-local':
              inputElement.type = 'datetime-local';
              break;
            default:
              inputElement.type = 'date';
          }
          break;

        case 'submit-button':
          inputElement = createElement('button');
          inputElement.type = 'submit';
          inputElement.className = themeStyles.button;
          inputElement.textContent = String(element.label || 'Submit').replace(/[<>"'&]/g, '');
          return inputElement;

        case 'reset-button':
          inputElement = createElement('button');
          inputElement.type = 'reset';
          inputElement.className = themeStyles.button.replace('bg-gray-900', 'bg-gray-600');
          inputElement.textContent = String(element.label || 'Reset').replace(/[<>"'&]/g, '');
          return inputElement;

        case 'spacer':
          return createElement('div', 'my-4');

        default:
          console.warn(`Unknown form element type: ${element.type}`);
          return null;
      }

      // Apply common attributes
      Object.keys(commonAttributes).forEach(key => {
        if (commonAttributes[key] !== null && commonAttributes[key] !== undefined) {
          inputElement[key] = commonAttributes[key];
        }
      });

      return inputElement;
    }

    async handleSubmit(event) {
      event.preventDefault();

      try {
        // Collect form data
        const formData = new FormData(this.form);
        const responseData = {};

        for (let [key, value] of formData.entries()) {
          responseData[key] = value;
        }

        // Show loading state
        this.showLoading();

        // Submit form
        const response = await makeRequest(`${AUTHENTIK_BASE_URL}/api/public/forms/${this.formId}/submit`, {
          method: 'POST',
          body: JSON.stringify({ responseData })
        });

        // Handle success
        this.showSuccess('Form submitted successfully!');
        
        if (this.options.onSuccess) {
          this.options.onSuccess(response);
        }

        // Reset form
        this.form.reset();

      } catch (error) {
        console.error('Form submission error:', error);
        this.showError('Failed to submit form. Please try again.');
        
        if (this.options.onError) {
          this.options.onError(error);
        }
      }
    }

    showLoading() {
      const submitButton = this.form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
      }
    }

    showSuccess(message) {
      const submitButton = this.form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
      }

      this.showMessage(message, 'success');
    }

    showError(message) {
      const submitButton = this.form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit';
      }

      this.showMessage(message, 'error');
    }

    showMessage(message, type) {
      // Remove existing messages
      const rootNode = this.root || this.container;
      const existingMessage = rootNode.querySelector && rootNode.querySelector('.authentik-message');
      if (existingMessage) {
        existingMessage.remove();
      }

      const messageElement = createElement('div', `authentik-message p-4 mb-4 rounded-lg ${
        type === 'success' 
          ? 'bg-green-100 border border-green-400 text-green-700' 
          : 'bg-red-100 border border-red-400 text-red-700'
      }`);
      messageElement.textContent = message;

      if (rootNode.firstChild) {
        rootNode.insertBefore(messageElement, rootNode.firstChild);
      } else {
        rootNode.appendChild(messageElement);
      }

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.remove();
        }
      }, 5000);
    }
  }

  // Global API
  window.AuthentikForms = {
    // Main function to embed a form
    embed: function(containerId, formId, options = {}) {
      return new AuthentikForm(containerId, formId, options);
    },

    // Configure base URL
    configure: function(config) {
      if (config.baseUrl) {
        window.AUTHENTIK_BASE_URL = config.baseUrl;
      }
    }
  };

  // Auto-initialize forms with data attributes
  document.addEventListener('DOMContentLoaded', function() {
    const autoForms = document.querySelectorAll('[data-authentik-form]');
    autoForms.forEach(container => {
      const formId = container.getAttribute('data-authentik-form');
      const theme = container.getAttribute('data-authentik-theme') || 'modern';
      const showTitle = container.getAttribute('data-authentik-show-title') !== 'false';
      const showDescription = container.getAttribute('data-authentik-show-description') !== 'false';

      if (formId && container.id) {
        new AuthentikForm(container.id, formId, {
          theme,
          showTitle,
          showDescription
        });
      }
    });
  });

})(window, document);
