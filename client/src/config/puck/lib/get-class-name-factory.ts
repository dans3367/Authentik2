// Simple className factory utility
export function getClassNameFactory(rootClass: string, styles: Record<string, string>) {
  return (options?: Record<string, boolean> | string) => {
    if (!options) {
      return styles[rootClass] || rootClass;
    }
    
    if (typeof options === 'string') {
      // Construct the full class name key (e.g., "ProductGrid-title")
      const fullKey = `${rootClass}-${options}`;
      return styles[fullKey] || options;
    }
    
    const classes = [styles[rootClass] || rootClass];
    
    Object.keys(options).forEach((key) => {
      if (options[key]) {
        // Construct the full class name key for modifiers
        const fullKey = `${rootClass}--${key}`;
        const className = styles[fullKey] || key;
        classes.push(className);
      }
    });
    
    return classes.join(' ');
  };
}
