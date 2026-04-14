export type BrandWeight = 0 | 1 | 2;

export interface BrandEntry {
  slug: string;
  name: string;
  weight: BrandWeight;
  aestheticLine: string;
}

export const BRAND_CATALOG: BrandEntry[] = [
  { slug: "our-legacy", name: "Our Legacy", weight: 2, aestheticLine: "workwear ample réinterprété, teintes sourdes gris-sable, jersey lourd, chemises oversize" },
  { slug: "lemaire", name: "Lemaire", weight: 2, aestheticLine: "ligne fluide, camel écru noir, manches longues, drapé, tailoring déstructuré" },
  { slug: "acne-studios", name: "Acne Studios", weight: 2, aestheticLine: "denim brut, silhouettes larges, cuir patiné, rose poudré, codes scandinaves" },
  { slug: "jacquemus", name: "Jacquemus", weight: 1, aestheticLine: "épures méditerranéennes, écru terracotta, volumes courts, petits sacs, côté soleil" },
  { slug: "aime-leon-dore", name: "Aimé Leon Dore", weight: 2, aestheticLine: "preppy new-yorkais, polos, chinos, sneakers rétro, tons crème burgundy marine" },
  { slug: "stussy", name: "Stüssy", weight: 1, aestheticLine: "streetwear Californien, tees graphiques, nylon, tons béton olive, 90s décontracté" },
  { slug: "carhartt-wip", name: "Carhartt WIP", weight: 1, aestheticLine: "workwear duck canvas, ample, poches utilitaires, beige marron noir" },
  { slug: "kapital", name: "Kapital", weight: 1, aestheticLine: "patchwork Japonais, indigo teint, boro, coupes étranges, folklore décalé" },
  { slug: "needles", name: "Needles", weight: 0, aestheticLine: "track pants papillon, velours, tailoring rétro, rayures, élégance dérangée" },
  { slug: "palace", name: "Palace", weight: 0, aestheticLine: "skateboarding UK, sportswear technique, logos discrets, tricolore" },
  { slug: "stone-island", name: "Stone Island", weight: 1, aestheticLine: "sportswear technique, teintures réactives, nylon métal, vert militaire, gris stone" },
  { slug: "rick-owens", name: "Rick Owens", weight: 1, aestheticLine: "drape sombre, cuir noir, asymétries, silhouettes longues, gothique contemporain" },
  { slug: "margiela", name: "Maison Margiela", weight: 2, aestheticLine: "déconstruction, tabi, blanc cassé, noir anthracite, tailoring éclaté, anonymat" },
  { slug: "auralee", name: "Auralee", weight: 1, aestheticLine: "matières sublimes, coton fin, camel poudré, ligne pure, luxe silencieux Japonais" },
  { slug: "uniqlo-u", name: "Uniqlo U", weight: 0, aestheticLine: "basiques sculptés, laine mélangée, minimalisme accessible, oversize contrôlé" },
  { slug: "arcteryx", name: "Arc'teryx", weight: 1, aestheticLine: "outdoor technique, gore-tex, gris ardoise noir, gorpcore urbain, coupes ergonomiques" },
  { slug: "gramicci", name: "Gramicci", weight: 0, aestheticLine: "pantalons escalade, nylon léger, ceinture intégrée, outdoor décontracté, tons terre" },
  { slug: "ralph-lauren", name: "Polo Ralph Lauren", weight: 1, aestheticLine: "preppy Américain, oxford boutonné, tweed, marine ivoire bordeaux, heritage Ivy" },
  { slug: "apc", name: "A.P.C.", weight: 1, aestheticLine: "denim brut Japonais, tailoring minimaliste Parisien, marine écru noir, discrétion" },
  { slug: "engineered-garments", name: "Engineered Garments", weight: 1, aestheticLine: "workwear hybride, poches multiples, tissus mixés, chasse américaine, kaki moutarde" },
  { slug: "universal-works", name: "Universal Works", weight: 0, aestheticLine: "workwear Anglais, laine grise, cordons, tweed, tailoring décontracté" },
  { slug: "patta", name: "Patta", weight: 0, aestheticLine: "streetwear Amsterdam, sportswear saturé, motifs graphiques, culture sneaker" },
  { slug: "drakes", name: "Drake's", weight: 0, aestheticLine: "tailoring Anglais relâché, tweed, cravates en laine, palette automne, Ivy League revisité" },
  { slug: "beams-plus", name: "Beams Plus", weight: 1, aestheticLine: "Ivy Japonais, madras, oxford, chinos, précision heritage, marine moutarde" },
  { slug: "marine-serre", name: "Marine Serre", weight: 0, aestheticLine: "upcycling, lune imprimée, skintight mixé workwear, futurisme critique, noir crème" },
  { slug: "bode", name: "Bode", weight: 0, aestheticLine: "textile vintage, quilt, broderies, Americana narratif, tons fanés, couture artisanale" },
  { slug: "jw-anderson", name: "JW Anderson", weight: 0, aestheticLine: "silhouettes étranges, volumes exagérés, couleurs vives, maille sculpturale, art conceptuel" },
  { slug: "junya-watanabe", name: "Junya Watanabe", weight: 1, aestheticLine: "patchwork technique, denim déconstruit, collabs workwear, Japonais expérimental" },
  { slug: "cdg", name: "Comme des Garçons", weight: 2, aestheticLine: "noir avant-garde, tailoring asymétrique, textures mixtes, silhouettes sculptées" },
  { slug: "noah", name: "Noah", weight: 0, aestheticLine: "preppy New-York rebelle, rugbies, tailoring marine, pop rock 60s, éthique affichée" },
];

export function brandBySlug(slug: string): BrandEntry | undefined {
  return BRAND_CATALOG.find((b) => b.slug === slug);
}

export function brandByName(name: string): BrandEntry | undefined {
  return BRAND_CATALOG.find((b) => b.name === name);
}
