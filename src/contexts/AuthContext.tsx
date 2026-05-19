import { createContext, useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/backend/client";
import type { Organization, Profile } from "@/types/database.types";

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
    organizationName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfileAndOrganization(userId: string) {
  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    const { data: bootstrappedProfile, error: bootstrapError } = await supabase
      .rpc("bootstrap_current_user_profile");

    if (bootstrapError || !bootstrappedProfile) {
      return { profile: null, organization: null };
    }

    profile = bootstrappedProfile;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .maybeSingle();

  return {
    profile: profile as unknown as Profile,
    organization: (organization as Organization) ?? null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "INITIAL_SESSION" || event === "SIGNED_IN") && session?.user) {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        setUser(session.user);

        void fetchProfileAndOrganization(session.user.id)
          .then((data) => {
            setProfile(data.profile);
            setOrganization(data.organization);
          })
          .finally(() => {
            setLoading(false);
            fetchingRef.current = false;
          });
      } else if (event === "INITIAL_SESSION" && !session) {
        setLoading(false);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setOrganization(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      organizationName: string,
    ) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            organization_name: organizationName,
          },
        },
      });
      if (error) {
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, organization, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
