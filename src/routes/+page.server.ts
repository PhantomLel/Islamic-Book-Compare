import type { PageServerLoad } from './$types';
import { error, redirect, type Actions } from '@sveltejs/kit';
import getDb from '$lib/server/db';


export const load: PageServerLoad = async () => {
  const db = await getDb();
  const total = await db.collection('books').countDocuments({});
  return { props: { total } };
};

export const actions = {
  default: async ({request}) => {
    let search = await request.formData();
    // url safe the search query
    const searchValue = search.get('search');
    if (searchValue === null) {
      throw error(400, 'No search query provided');
    }

    throw redirect(307, `/search?search=${encodeURIComponent(searchValue.toString())}&instock=true&sort=rel`);
  }
} satisfies Actions