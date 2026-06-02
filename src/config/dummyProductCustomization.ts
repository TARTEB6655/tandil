import type { ProductCustomizationConfig } from '../types/productCustomization';

const sheepNamePattern = /(sheep|najdi|خروف|نعيمي)/i;

export function isSheepLikeProductName(name: string): boolean {
  return sheepNamePattern.test(name || '');
}

export function getDefaultSheepCustomization(): ProductCustomizationConfig {
  return {
    groups: [
      {
        id: 'packaging_type',
        title: 'Packaging type',
        subtitle: 'Required - Select one',
        required: true,
        selectionMode: 'single',
        options: [
          {
            id: 'in_bag',
            label: 'In bag',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=240&q=60',
          },
        ],
      },
      {
        id: 'cutting',
        title: 'Cutting',
        subtitle: 'Required - Select one',
        required: true,
        selectionMode: 'single',
        options: [
          {
            id: 'arabic_8',
            label: 'Arabic cut (8 pieces)',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1603048297172-c92544798d5a?auto=format&fit=crop&w=240&q=60',
          },
          {
            id: 'biryani_large',
            label: 'Biryani cut (large)',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=240&q=60',
          },
          {
            id: 'thalath_medium',
            label: 'Thalath cut (medium)',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1615937691194-97dbd3f3dc29?auto=format&fit=crop&w=240&q=60',
          },
          {
            id: 'small_cuts',
            label: 'Small cuts',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=240&q=60',
          },
        ],
      },
      {
        id: 'packing',
        title: 'Packing',
        subtitle: 'Required - Select one',
        required: true,
        selectionMode: 'single',
        options: [
          {
            id: 'foam',
            label: 'Foam',
            subtitle: '+10.00 AED',
            priceDelta: 10,
            imageUrl:
              'https://images.unsplash.com/photo-1615485291234-9b68f1f2be91?auto=format&fit=crop&w=240&q=60',
          },
          {
            id: 'normal',
            label: 'Normal',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=240&q=60',
          },
        ],
      },
      {
        id: 'contains',
        title: 'Contains',
        subtitle: 'Optional - Select any',
        required: false,
        selectionMode: 'multiple',
        options: [
          {
            id: 'belly',
            label: 'Belly',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=240&q=60',
          },
          {
            id: 'head',
            label: 'Head',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=240&q=60',
          },
          {
            id: 'intestines',
            label: 'Intestines',
            subtitle: 'Free',
            priceDelta: 0,
            imageUrl:
              'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?auto=format&fit=crop&w=240&q=60',
          },
        ],
      },
      {
        id: 'weight',
        title: 'Najdi weight',
        subtitle: 'Optional - Select one',
        required: false,
        selectionMode: 'single',
        options: [
          {
            id: '8_10',
            label: '8-10 KG',
            subtitle: 'age 3-4 (+210 AED)',
            priceDelta: 210,
            imageUrl:
              'https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=240&q=60',
          },
          {
            id: '11_13',
            label: '11-13 KG',
            subtitle: 'age 5-6 (+260 AED)',
            priceDelta: 260,
            imageUrl:
              'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=240&q=60',
          },
        ],
      },
    ],
  };
}
