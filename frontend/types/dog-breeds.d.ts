declare module 'dog-breeds' {
  interface DogBreed {
    name: string;
    origin: string;
    imageURL: string;
  }
  export const all: DogBreed[];
  export function random(): DogBreed;
}
