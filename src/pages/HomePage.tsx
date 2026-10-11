import { CategorySection } from '@/components/home/CategorySection';
import { FeaturedSection } from '@/components/home/FeaturedSection';
import { Hero } from '@/components/home/Hero';
import { MapPreviewSection } from '@/components/home/MapPreviewSection';
import { PartnerCta } from '@/components/home/PartnerCta';
import { Footer } from '@/components/layout/Footer';
import { EMPTY_FILTERS } from '@/state/searchState';
import { useCenterSearch } from '@/state/useCenterSearch';

/**
 * Home: what the catalogue holds (hero with numbers), real places, the main
 * directions, where they are in the city, and an invitation for centres.
 */
export function HomePage() {
  const { items } = useCenterSearch(EMPTY_FILTERS);

  return (
    <>
      <Hero />
      <FeaturedSection centers={items} />
      <CategorySection />
      <MapPreviewSection centers={items} />
      <PartnerCta />
      <Footer />
    </>
  );
}
