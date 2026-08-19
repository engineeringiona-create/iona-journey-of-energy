const container = document.getElementById('iona-admin-root');

if (container) {
  Promise.all([import('react'), import('react-dom/client'), import('../components/Admin/AdminApp.jsx')]).then(
    ([React, { createRoot }, { default: AdminApp }]) => {
      createRoot(container).render(
        React.createElement(React.StrictMode, null, React.createElement(AdminApp))
      );
    }
  );
}
