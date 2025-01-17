export async function fetchSupabase(table: string, query = {}) {
    const queryString = new URLSearchParams(query).toString();
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/${table}${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    return response.json();
  }