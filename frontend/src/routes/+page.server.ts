import type { PageServerLoad } from './$types';
import { apiUrl } from '$lib';
import { error, redirect, type Actions } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {

  let data = await  fetch(apiUrl + "totalBooks");
  let json = await data.json();
  return {
    props: {
      total : json.total
    }
  }
};

export const actions = {
  default: async ({request}) => {
    let search = await request.formData();
    // url safe the search query
    const searchValue = search.get('search');
    if (searchValue === null) {
      throw error(400, 'No search query provided');
    }

    throw redirect(307, `/search?search=${encodeURIComponent(searchValue.toString())}&instock=true`);
  }
} satisfies Actions