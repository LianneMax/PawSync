'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button, ButtonArrow } from '@/components/ui/button';
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const CAT_BREEDS = [
  'Abyssinian', 'American Bobtail', 'American Curl', 'American Shorthair', 'American Wirehair',
  'Balinese', 'Bengal', 'Birman', 'Bombay', 'British Longhair', 'British Shorthair', 'Burmese', 'Burmilla',
  'Chartreux', 'Chausie', 'Cornish Rex', 'Cymric',
  'Devon Rex', 'Donskoy',
  'Egyptian Mau', 'European Shorthair', 'Exotic Shorthair',
  'Havana Brown', 'Himalayan',
  'Japanese Bobtail', 'Javanese',
  'Khao Manee', 'Korat', 'Kurilian Bobtail',
  'LaPerm', 'Lykoi',
  'Maine Coon', 'Manx', 'Minskin', 'Munchkin',
  'Nebelung', 'Norwegian Forest Cat',
  'Ocicat', 'Oriental Longhair', 'Oriental Shorthair',
  'Persian', 'Peterbald', 'Pixie-Bob',
  'Ragamuffin', 'Ragdoll', 'Russian Blue',
  'Savannah', 'Scottish Fold', 'Selkirk Rex', 'Siamese', 'Siberian', 'Singapura', 'Snowshoe', 'Sokoke', 'Somali', 'Sphynx',
  'Thai', 'Tonkinese', 'Toyger', 'Turkish Angora', 'Turkish Van',
  'Mixed / Unknown',
];

function formatBreedName(breed: string, sub?: string): string {
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (sub) return `${capitalize(sub)} ${capitalize(breed)}`;
  return capitalize(breed);
}

interface BreedComboboxProps {
  species: 'dog' | 'cat' | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function BreedCombobox({ species, value, onChange, placeholder = 'Select Breed*', required, className }: BreedComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [breeds, setBreeds] = React.useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (species === 'cat') {
      setBreeds(CAT_BREEDS.map((b) => ({ value: b.toLowerCase(), label: b })));
      return;
    }

    if (species === 'dog') {
      setLoading(true);
      fetch('https://dog.ceo/api/breeds/list/all')
        .then((res) => res.json())
        .then((data) => {
          const list: { value: string; label: string }[] = [];
          const msg: Record<string, string[]> = data.message;
          for (const breed of Object.keys(msg)) {
            if (msg[breed].length > 0) {
              for (const sub of msg[breed]) {
                const label = formatBreedName(breed, sub);
                list.push({ value: label.toLowerCase(), label });
              }
            } else {
              const label = formatBreedName(breed);
              list.push({ value: label.toLowerCase(), label });
            }
          }
          list.sort((a, b) => a.label.localeCompare(b.label));
          list.push({ value: 'mixed / unknown', label: 'Mixed / Unknown' });
          setBreeds(list);
        })
        .catch(() => {
          setBreeds([{ value: 'mixed / unknown', label: 'Mixed / Unknown' }]);
        })
        .finally(() => setLoading(false));
      return;
    }

    setBreeds([]);
  }, [species]);

  const selectedLabel = breeds.find((b) => b.value === value.toLowerCase())?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          mode="input"
          placeholder={!value}
          aria-expanded={open}
          className={cn(
            'w-full h-13 px-4 rounded-xl border-gray-200 bg-gray-50 hover:bg-gray-50 text-base font-normal shadow-xs shadow-black/5',
            !value && 'text-gray-400',
            className,
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ButtonArrow />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popper-anchor-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={loading ? 'Loading breeds...' : 'Search breed...'} />
          <CommandList>
            <CommandEmpty>{loading ? 'Loading...' : 'No breed found.'}</CommandEmpty>
            <CommandGroup>
              {breeds.map((breed) => (
                <CommandItem
                  key={breed.value}
                  value={breed.value}
                  keywords={[breed.label]}
                  onSelect={(currentValue) => {
                    const selected = breeds.find((b) => b.value === currentValue);
                    onChange(currentValue === value.toLowerCase() ? '' : (selected?.label || currentValue));
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{breed.label}</span>
                  {value.toLowerCase() === breed.value && <CommandCheck />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      {required && <input type="text" value={value} required tabIndex={-1} className="sr-only" onChange={() => {}} />}
    </Popover>
  );
}
