'use client';

import * as React from 'react';
import DOG_BREEDS_DATA from 'dog-breeds/dog-breeds.json';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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


interface BreedComboboxProps {
  species: 'canine' | 'feline' | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  className?: string;
}

export function BreedCombobox({ species, value, onChange, placeholder = 'Select Breed*', error, className }: BreedComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [breeds, setBreeds] = React.useState<{ value: string; label: string }[]>([]);

  React.useEffect(() => {
    if (species === 'feline') {
      setBreeds(CAT_BREEDS.map((b) => ({ value: b.toLowerCase(), label: b })));
      return;
    }

    if (species === 'canine') {
      const list = DOG_BREEDS_DATA
        .map((b) => ({ value: b.name.toLowerCase(), label: b.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
      list.push({ value: 'mixed / unknown', label: 'Mixed / Unknown' });
      setBreeds(list);
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
            'w-full h-13 px-4 rounded-xl bg-gray-50 hover:bg-gray-50 text-base font-normal shadow-xs shadow-black/5',
            error ? 'border-[#900B09]/20' : 'border-gray-200',
            !value && 'text-gray-400',
            className,
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popper-anchor-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search breed..." />
          <CommandList>
            <CommandEmpty>No breed found.</CommandEmpty>
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
      {error && <p className="text-xs text-[#900B09] mt-1 ml-1">This field is required</p>}
    </Popover>
  );
}
