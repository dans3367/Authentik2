// Simple className factory utility
export function getClassNameFactory(rootClass: string, styles: Record<string, string>) {
  return (options?: Record<string, boolean> | string) => {
    if (!options) {
      return styles[rootClass] || rootClass;
    }
    
    if (typeof options === 'string') {
      return styles[options] || options;
    }
    
    const classes = [styles[rootClass] || rootClass];
    
    Object.keys(options).forEach((key) => {
      if (options[key]) {
        const className = styles[key] || key;
        classes.push(className);
      }
    });
    
    return classes.join(' ');
  };
}
