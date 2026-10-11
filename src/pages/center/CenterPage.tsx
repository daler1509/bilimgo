import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ArrowUpRight, AtSign, ChevronRight, Clock3, Globe, Map as MapIcon, MapPin, Navigation, Phone, Send, Share2, Tag } from 'lucide-react';
import { CategoryGlyph } from '@/components/centers/CategoryGlyph';
import { CenterCard } from '@/components/centers/CenterCard';
import { NetworkBadge, PlaceBadges } from '@/components/centers/CenterBadges';
import { backTarget, CenterLink, type FromState } from '@/components/centers/CenterLink';
import { CenterLogo } from '@/components/centers/CenterLogo';
import {
  altNameOf,
  courseDirection,
  distanceFromCenter,
  districtLabel,
  handleOf,
  hostOf,
  kindLabel,
  openNow,
  primaryCategory,
  routeUrl,
  sourceLabel,
  telHref,
  visibleCategories,
} from '@/components/centers/centerText';
import { CompareButton } from '@/components/centers/CompareButton';
import { FavoriteButton } from '@/components/centers/FavoriteButton';
import { Gallery } from '@/components/centers/Gallery';
import { LeadDialog } from '@/components/centers/LeadDialog';
import { Footer } from '@/components/layout/Footer';
import { MapView } from '@/components/map/MapView';
import { centersToMarkers } from '@/components/map/markerData';
import { RevealText } from '@/components/motion/RevealText';
import { Button, ButtonLink, IconButton, buttonClass } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StateMessage } from '@/components/ui/StateMessage';
import { CATEGORY_BY_ID } from '@/data/categories';
import type { Center } from '@/data/types';
import { AGE_HINT, AGE_LABEL, fill, FORMAT_LABEL, LANGUAGE_LABEL, t } from '@/i18n';
import { formatDay } from '@/lib/dates';
import { distanceKm, formatDistance } from '@/lib/geo';
import { hoursRows } from '@/lib/openingHours';
import { centersRepository } from '@/services/centersRepository';
import { EMPTY_FILTERS } from '@/state/searchState';
import { useCenterSearch } from '@/state/useCenterSearch';
import { useUi } from '@/state/ui';
import s from './center.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

function useCenter(id: string) {
  const [center, setCenter] = useState<Center | null | undefined>(undefined);
  const [branches, setBranches] = useState<Center[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    setCenter(undefined);
    setBranches([]);
    centersRepository
      .getById(id, { signal: ctrl.signal })
      .then(async (c) => {
        setCenter(c);
        if (c) setBranches(await centersRepository.getBranches(c, { signal: ctrl.signal }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [id]);
  return { center, branches };
}

/** A row in a definition list; rows the sources say nothing about are left out */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.detail}>
      <dt className={s.detailLabel}>{label}</dt>
      <dd className={s.detailValue}>{children}</dd>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={s.section} aria-labelledby={id}>
      <h2 className={s.sectionTitle} id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The destination of «Подробнее»: everything the sources know about one place. */
export function CenterPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useUi();
  const { center, branches } = useCenter(id);
  const [lead, setLead] = useState<{ course: string | null } | null>(null);

  const from = (location.state as FromState | null)?.from;
  const back = backTarget(from);
  const goBack = () => (from && window.history.state?.idx > 0 ? navigate(-1) : navigate(back.to));

  const primary = center ? primaryCategory(center) : null;
  const similarFilters = useMemo(() => (primary ? { ...EMPTY_FILTERS, categories: [primary] } : null), [primary]);
  const similar = useCenterSearch(similarFilters ?? EMPTY_FILTERS);

  useEffect(() => {
    if (center) document.title = `${center.name} — BilimGo`;
    return () => {
      document.title = t.meta.title;
    };
  }, [center]);

  // a new profile starts with the request form closed
  useEffect(() => setLead(null), [id]);

  if (center === null) {
    return (
      <div className="container" style={{ paddingBlock: 'clamp(64px, 12vh, 140px)' }}>
        <StateMessage
          icon={<MapPin size={24} />}
          title={t.center.notFound}
          text={t.center.notFoundText}
          actions={
            <ButtonLink to="/search" variant="primary">
              {t.back.catalog}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  if (center === undefined) return <CenterSkeleton />;

  const c = center;
  const status = openNow(c);
  const rows = hoursRows(c.openingHours);
  const phone = c.phones?.[0];
  const mapHref = `/map?sel=${c.id}&v=${c.location.lat.toFixed(5)},${c.location.lng.toFixed(5)},15.5`;
  const cats = visibleCategories(c);
  const altName = altNameOf(c);
  const identity = [kindLabel(c), c.branch && fill(t.center.branch, { name: c.branch }), altName].filter(Boolean).join(', ');
  // what a request can be about: the published courses or, without them, the directions
  const courses = c.programs?.length
    ? c.programs.map((p) => ({ title: p.title, note: p.note, direction: courseDirection(p.title, primary) }))
    : cats.map((cat) => ({ title: CATEGORY_BY_ID[cat].label, note: undefined, direction: cat }));
  const audienceKnown = !!(c.ages?.length || c.audienceNote || c.formats?.length || c.teaching?.length);

  // nearest places of the same direction, one per brand
  const seenBrands = new Set([c.brand ?? c.id]);
  const similarItems = similarFilters
    ? similar.items
        .filter((x) => x.id !== c.id)
        .sort((a, b) => distanceKm(a.location, c.location) - distanceKm(b.location, c.location))
        .filter((x) => {
          const key = x.brand ?? x.id;
          if (seenBrands.has(key)) return false;
          seenBrands.add(key);
          return true;
        })
        .slice(0, 3)
    : [];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: c.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t.center.linkCopied);
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  const locationMap = (
    <div className={s.mapCard}>
      <MapView
        markers={centersToMarkers([c])}
        selectedId={c.id}
        initialView={{ center: c.location, zoom: 15 }}
        gestures="cooperative"
        openHref={mapHref}
        openHint={false}
        controls={{ zoom: true }}
        followSelection={false}
        ariaLabel={`${t.center.whereTitle}: ${c.name}`}
      />
      <Link to={mapHref} className={s.mapLink}>
        <MapIcon size={15} aria-hidden="true" />
        {t.results.showOnMap}
      </Link>
    </div>
  );

  return (
    <div className={s.page}>
      <div className="container">
        <nav className={s.crumbs} aria-label={t.center.crumbs}>
          <button type="button" className={s.back} onClick={goBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>{back.label}</span>
          </button>
          <ol className={s.crumbList}>
            <li>
              <Link to="/search">{t.nav.search}</Link>
            </li>
            {primary && (
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <Link to={`/search?cat=${primary}`}>{CATEGORY_BY_ID[primary].label}</Link>
              </li>
            )}
            <li aria-current="page">
              <ChevronRight size={14} aria-hidden="true" />
              <span>{c.name}</span>
            </li>
          </ol>
        </nav>

        {/* ---------------- hero ---------------- */}
        <header className={s.hero}>
          <div className={s.heroText}>
            <div className={s.identity}>
              <CenterLogo center={c} size={64} decorative={false} className={s.logo} />
              <div className={s.names}>
                <RevealText as="h1" key={c.id} className={s.title}>
                  {c.name}
                </RevealText>
                <p className={s.kind}>{identity}</p>
              </div>
            </div>

            {(c.popular || c.networkSize > 1) && (
              <div className={s.badges}>
                <PlaceBadges center={c} row />
                <NetworkBadge center={c} />
              </div>
            )}

            {c.summary && <p className={s.lead}>{c.summary}</p>}

            <ul className={s.meta}>
              <li>
                <MapPin size={16} aria-hidden="true" />
                <span>
                  {c.address ?? districtLabel(c)}
                  <span className={s.muted}>
                    {c.address ? `, ${districtLabel(c)}` : ''}, {distanceFromCenter(c)}
                  </span>
                </span>
              </li>
              {status && (
                <li data-open={status.open}>
                  <Clock3 size={16} aria-hidden="true" />
                  <span>{status.label}</span>
                </li>
              )}
            </ul>

            <div className={s.actions}>
              <Button variant="primary" size="lg" className={s.primaryAction} onClick={() => setLead({ course: null })}>
                {t.courses.enroll}
              </Button>
              {phone ? (
                <a className={buttonClass({ variant: 'secondary', size: 'lg' }, s.primaryAction)} href={telHref(phone)}>
                  <Phone size={17} aria-hidden="true" />
                  <span>{t.center.call}</span>
                </a>
              ) : (
                <a className={buttonClass({ variant: 'secondary', size: 'lg' }, s.primaryAction)} href={routeUrl(c)} {...external}>
                  <Navigation size={17} aria-hidden="true" />
                  <span>{t.center.route}</span>
                </a>
              )}
            </div>
            <div className={s.tools}>
              {phone && (
                <a className={buttonClass({ variant: 'secondary', size: 'md' })} href={routeUrl(c)} {...external}>
                  <Navigation size={16} aria-hidden="true" />
                  <span>{t.center.route}</span>
                </a>
              )}
              <FavoriteButton id={c.id} name={c.name} variant="labeled" />
              <CompareButton id={c.id} name={c.name} variant="labeled" />
              <IconButton label={t.center.share} variant="secondary" onClick={share}>
                <Share2 size={17} />
              </IconButton>
            </div>
          </div>

          <div className={s.media}>{c.photos?.length ? <Gallery photos={c.photos} name={c.name} /> : locationMap}</div>
        </header>

        {/* ---------------- body ---------------- */}
        <div className={s.layout}>
          <div className={s.main}>
            <Section id="about" title={t.center.about}>
              {c.about?.length ? (
                <div className={s.prose}>
                  {c.about.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              ) : (
                <p className={s.placeholder}>{t.center.noAbout}</p>
              )}
            </Section>

            {courses.length > 0 && (
              <Section id="courses" title={t.courses.title}>
                <p className={s.sectionLead}>{c.programs?.length ? t.courses.lead : `${t.courses.fromDirections} ${t.courses.lead}`}</p>
                {/* each course is one tap away from a request about it */}
                <ul className={s.courseGrid}>
                  {courses.map((course) => (
                    <li key={course.title} className={s.courseItem}>
                      <button
                        type="button"
                        className={s.courseCard}
                        onClick={() => setLead({ course: course.title })}
                        aria-label={`${t.courses.ask}: ${course.title}`}
                      >
                        <span className={s.courseTop}>
                          {course.direction && <CategoryGlyph id={course.direction} size={40} className={s.courseGlyph} />}
                          <span className={s.coursePrice}>
                            <Tag size={13} aria-hidden="true" />
                            {t.courses.price}
                          </span>
                        </span>
                        <span className={s.courseBody}>
                          <span className={s.courseTitle}>{course.title}</span>
                          {course.note && <span className={s.courseNote}>{course.note}</span>}
                        </span>
                        <span className={buttonClass({ variant: 'secondary', size: 'md', block: true }, s.courseAsk)} aria-hidden="true">
                          {t.courses.ask}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className={s.advice}>
                  <div className={s.adviceText}>
                    <h3 className={s.adviceTitle}>{t.courses.adviceTitle}</h3>
                    <p>{t.courses.adviceText}</p>
                  </div>
                  <Button variant="primary" size="lg" className={s.adviceButton} onClick={() => setLead({ course: null })}>
                    {t.courses.adviceCta}
                  </Button>
                </div>
              </Section>
            )}

            <Section id="audience" title={t.center.audienceTitle}>
              {audienceKnown ? (
                <dl className={s.details}>
                  {(c.ages?.length || c.audienceNote) && (
                    // the sources name groups a centre has, not everyone it teaches
                    <Detail label={c.ages?.length ? t.center.agesKnown : t.center.audience}>
                      {c.ages?.map((a) => `${AGE_LABEL[a]} (${AGE_HINT[a]})`).join(', ')}
                      {c.audienceNote && <span className={s.detailNote}>{c.audienceNote}</span>}
                    </Detail>
                  )}
                  {c.formats?.length ? <Detail label={t.center.formats}>{c.formats.map((f) => FORMAT_LABEL[f]).join(t.center.and)}</Detail> : null}
                  {c.teaching?.length ? <Detail label={t.center.teaching}>{c.teaching.map((l) => LANGUAGE_LABEL[l]).join(', ')}</Detail> : null}
                </dl>
              ) : (
                <p className={s.placeholder}>{t.center.audienceUnknown}</p>
              )}
            </Section>
          </div>

          <aside className={s.aside} aria-label={t.center.contactsTitle}>
            <div className={s.contactCard}>
              <h2 className={s.cardTitle}>{t.center.contactsTitle}</h2>

              {/* photos took the hero — the map moves here */}
              {c.photos?.length ? <div className={s.asideMap}>{locationMap}</div> : null}

              {c.phones?.length ? (
                <ul className={s.contactList}>
                  {c.phones.map((p) => (
                    <li key={p}>
                      <a className={s.contactLink} href={telHref(p)}>
                        <Phone size={16} aria-hidden="true" />
                        <span className="tabular">{p}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.cardNote}>{t.center.noContacts}</p>
              )}

              {(c.website || c.telegram || c.instagram) && (
                <ul className={s.contactList}>
                  {c.website && (
                    <li>
                      <a className={s.contactLink} href={c.website} {...external}>
                        <Globe size={16} aria-hidden="true" />
                        <span>{hostOf(c.website)}</span>
                        <ArrowUpRight size={14} className={s.ext} aria-hidden="true" />
                      </a>
                    </li>
                  )}
                  {c.telegram && (
                    <li>
                      <a className={s.contactLink} href={c.telegram} {...external}>
                        <Send size={16} aria-hidden="true" />
                        <span>
                          Telegram <span className={s.handle}>{handleOf(c.telegram)}</span>
                        </span>
                        <ArrowUpRight size={14} className={s.ext} aria-hidden="true" />
                      </a>
                    </li>
                  )}
                  {c.instagram && (
                    <li>
                      <a className={s.contactLink} href={c.instagram} {...external}>
                        <AtSign size={16} aria-hidden="true" />
                        <span>
                          Instagram <span className={s.handle}>{handleOf(c.instagram)}</span>
                        </span>
                        <ArrowUpRight size={14} className={s.ext} aria-hidden="true" />
                      </a>
                    </li>
                  )}
                </ul>
              )}

              <div className={s.cardBlock}>
                <h3 className={s.cardLabel}>{t.center.hours}</h3>
                {rows.length ? (
                  <table className={s.hours}>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.days + r.time} data-today={r.today || undefined} data-closed={r.closed || undefined}>
                          <th scope="row">{r.days}</th>
                          <td>{r.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className={s.noData}>{t.center.noData}</p>
                )}
              </div>

              <div className={s.cardBlock}>
                <h3 className={s.cardLabel}>{t.center.address}</h3>
                <p className={s.address}>{c.address ?? t.center.noData}</p>
                <p className={s.cardNote}>
                  {districtLabel(c)}, {distanceFromCenter(c)}
                </p>
                <div className={s.cardActions}>
                  <a className={buttonClass({ variant: 'secondary', size: 'sm' })} href={routeUrl(c)} {...external}>
                    <Navigation size={14} aria-hidden="true" />
                    <span>{t.center.route}</span>
                  </a>
                  <ButtonLink to={mapHref} variant="ghost" size="sm" leading={<MapIcon size={14} />}>
                    {t.results.showOnMap}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </aside>

          {branches.length > 0 && (
            <div className={s.branchesBlock}>
              <Section id="branches" title={t.center.branches}>
                <ul className={s.branches}>
                  {branches.map((b) => (
                    <li key={b.id}>
                      <CenterLink id={b.id} className={s.branch}>
                        <MapPin size={16} aria-hidden="true" />
                        <span className={s.branchText}>
                          <span className={s.branchName}>{b.address ?? b.name}</span>
                          <span className={s.branchMeta}>
                            {districtLabel(b)}, {fill(t.center.branchDistance, { d: formatDistance(distanceKm(b.location, c.location)) })}
                          </span>
                        </span>
                        <ChevronRight size={16} className={s.branchArrow} aria-hidden="true" />
                      </CenterLink>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}

          <section className={s.sources} aria-label={t.center.sourcesLabel}>
            <p>
              {t.center.checked} {formatDay(center.checkedAt)}. {t.center.sourcesLabel}:{' '}
              <a href={c.yandexUrl} {...external}>
                {t.center.onYandex}
              </a>
              {c.sources.map((src) => (
                <span key={src.url}>
                  {', '}
                  <a href={src.url} {...external}>
                    {sourceLabel(src.url)}
                  </a>
                </span>
              ))}
              . {t.center.verifyNote}
            </p>
          </section>
        </div>

        {similarItems.length > 0 && (
          <section className={s.similar} aria-labelledby="similar-title">
            <div className={s.similarHead}>
              <h2 className={s.sectionTitle} id="similar-title">
                {t.center.similar}
              </h2>
              {primary && (
                <Link to={`/search?cat=${primary}`} className={s.similarAll}>
                  {fill(t.center.similarAll, { label: CATEGORY_BY_ID[primary].label })}
                </Link>
              )}
            </div>
            <ul className={s.similarGrid}>
              {similarItems.map((x) => (
                <li key={x.id}>
                  <CenterCard center={x} primaryAction="link" detailsHref={`/centers/${x.id}`} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Footer />

      <LeadDialog
        open={!!lead}
        onClose={() => setLead(null)}
        center={c}
        courses={courses.map((x) => x.title)}
        course={lead?.course ?? null}
      />
    </div>
  );
}

function CenterSkeleton() {
  return (
    <div className="container" aria-busy="true" aria-label={t.center.loading}>
      <div className={s.hero} style={{ paddingTop: 72 }}>
        <div className={s.heroText}>
          <div className={s.identity}>
            <Skeleton width={64} height={64} radius={15} />
            <div className={s.names}>
              <Skeleton width="70%" height={36} />
              <Skeleton width={140} height={12} style={{ marginTop: 10 }} />
            </div>
          </div>
          <Skeleton width="90%" height={16} style={{ marginTop: 24 }} />
          <Skeleton width="60%" height={16} style={{ marginTop: 10 }} />
          <Skeleton width="50%" height={14} style={{ marginTop: 28 }} />
          <Skeleton width={220} height={48} radius={14} style={{ marginTop: 28 }} />
        </div>
        <div className={s.media}>
          <Skeleton width="100%" height="100%" radius={18} style={{ minHeight: 280 }} />
        </div>
      </div>
    </div>
  );
}
