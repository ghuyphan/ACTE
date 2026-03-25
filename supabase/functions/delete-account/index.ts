import { createClient } from 'jsr:@supabase/supabase-js@2';

type DeleteAccountResponse =
  | { success: true }
  | { success: false; error: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authorization = request.headers.get('Authorization') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return Response.json<DeleteAccountResponse>(
        {
          success: false,
          error: 'Delete account function is not configured on the server.',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return Response.json<DeleteAccountResponse>(
        {
          success: false,
          error: 'Authentication required.',
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return Response.json<DeleteAccountResponse>(
        {
          success: false,
          error: deleteError.message || 'Could not delete this account right now.',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json<DeleteAccountResponse>({ success: true }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected delete-account failure.';
    return Response.json<DeleteAccountResponse>(
      {
        success: false,
        error: message,
      },
      { status: 500, headers: corsHeaders }
    );
  }
});
