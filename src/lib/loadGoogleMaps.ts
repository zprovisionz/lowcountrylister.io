declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

let googleMapsLoading = false;
let googleMapsLoaded = false;

export function loadGoogleMapsAPI(): Promise<void> {
  return new Promise((resolve, _reject) => {
    // If already loaded, resolve immediately
    if (googleMapsLoaded && window.google && window.google.maps && window.google.maps.places) {
      resolve();
      return;
    }

    // If already loading, wait for it
    if (googleMapsLoading) {
      const checkInterval = setInterval(() => {
        if (googleMapsLoaded && window.google && window.google.maps && window.google.maps.places) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      // No API key, resolve anyway (will use fallback)
      resolve();
      return;
    }

    googleMapsLoading = true;

    // Initialize callback
    window.initGoogleMaps = () => {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      resolve();
    };

    // Create and append script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      googleMapsLoading = false;
      // Resolve anyway (will use fallback)
      resolve();
    };
    
    document.head.appendChild(script);
  });
}


