document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
    try {
      const savedTheme = localStorage.getItem('interviewhacker-theme');
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      const theme = savedTheme || systemTheme;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')
        .setAttribute('content', theme === 'dark' ? '#0f1115' : '#f5f6f8');
    } catch {
      document.documentElement.dataset.theme = 'light';
    }
