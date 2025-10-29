export const MENU = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    items: [
      {
        id: 'br1',
        name: 'Croissant & Coffee',
        desc: 'Fresh butter croissant with a flat white',
        price: 55,
        image: 'https://www.cafefrank.com/wp-content/uploads/2024/09/Salad-selection-crop1-800x533.jpg',
      },
      {
        id: 'br2',
        name: 'Avocado Toast',
        desc: 'Sourdough, smashed avo, lemon & chilli flakes',
        price: 65,
        image: 'https://www.cafefrank.com/wp-content/uploads/2024/09/Salad-selection-crop1-800x533.jpg',
      },
    ],
  },
  {
    id: 'lunch',
    name: 'Lunch',
    items: [
      {
        id: 'ln1',
        name: 'Grilled Chicken Bowl',
        desc: 'Char-grilled chicken, brown rice & greens',
        price: 95,
        image: 'https://www.cafefrank.com/wp-content/uploads/2024/09/Salad-selection-crop1-800x533.jpg',
      },
      {
        id: 'ln2',
        name: 'Beef Brisket Roll',
        desc: 'Slow-cooked beef, pickles & mustard',
        price: 98,
        image: 'https://www.cafefrank.com/wp-content/uploads/2024/09/Salad-selection-crop1-800x533.jpg',
      },
    ],
  },
];

export const findItemById = (id) => {
  for (const cat of MENU) {
    const found = cat.items.find((item) => item.id === id);
    if (found) return found;
  }
  return null;
};
