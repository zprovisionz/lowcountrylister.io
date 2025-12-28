import { useEffect } from 'react';

interface StructuredDataProps {
  type?: 'LocalBusiness' | 'Service' | 'WebSite';
}

/**
 * Structured Data Component for SEO
 * Adds JSON-LD structured data to the page for better search engine understanding
 */
export default function StructuredData({ type = 'LocalBusiness' }: StructuredDataProps) {
  useEffect(() => {
    // Remove existing structured data script if present
    const existingScript = document.getElementById('structured-data');
    if (existingScript) {
      existingScript.remove();
    }

    // Create structured data based on type
    let structuredData: any;

    if (type === 'LocalBusiness') {
      structuredData = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'Lowcountry Listings AI',
        description: 'AI-powered real estate listing generator specifically designed for Charleston, SC realtors. Generate MLS descriptions, Airbnb listings, and social media captions with hyper-local neighborhood intelligence.',
        url: 'https://lowcountrylistings.ai',
        logo: 'https://lowcountrylistings.ai/logo.png',
        image: 'https://lowcountrylistings.ai/og-image.png',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Charleston',
          addressRegion: 'SC',
          addressCountry: 'US',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: '32.7765',
          longitude: '-79.9311',
        },
        areaServed: {
          '@type': 'City',
          name: 'Charleston',
          sameAs: 'https://en.wikipedia.org/wiki/Charleston,_South_Carolina',
        },
        serviceArea: {
          '@type': 'GeoCircle',
          geoMidpoint: {
            '@type': 'GeoCoordinates',
            latitude: '32.7765',
            longitude: '-79.9311',
          },
          geoRadius: {
            '@type': 'Distance',
            value: '50',
            unitCode: 'MI',
          },
        },
        priceRange: '$$',
        telephone: '+1-843-XXX-XXXX', // Update with actual phone if available
      };
    } else if (type === 'Service') {
      structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: 'Real Estate Listing Generator',
        provider: {
          '@type': 'LocalBusiness',
          name: 'Lowcountry Listings AI',
        },
        areaServed: {
          '@type': 'City',
          name: 'Charleston',
          addressRegion: 'SC',
        },
        description: 'AI-powered real estate listing description generator for Charleston, SC. Generate professional MLS descriptions, Airbnb listings, and social media captions with verified neighborhood data and driving distances.',
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: '0',
          description: 'Free tier available with 3 generations per month',
        },
      };
    } else {
      // WebSite
      structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Lowcountry Listings AI',
        url: 'https://lowcountrylistings.ai',
        description: 'AI-powered real estate listing generator for Charleston, SC realtors',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://lowcountrylistings.ai/generate?address={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      };
    }

    // Create and append script tag
    const script = document.createElement('script');
    script.id = 'structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById('structured-data');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [type]);

  return null; // This component doesn't render anything
}

