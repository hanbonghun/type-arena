// apps/web/lib/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

const nextAuth = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      // account가 있으면 최초 로그인 또는 재인증
      if (account?.provider === "google" && profile) {
        const dbUser = await prisma.userAccount.upsert({
          where: { googleSub: profile.sub! },
          update: { displayName: profile.name ?? "Player" },
          create: {
            googleSub: profile.sub!,
            displayName: profile.name ?? "Player",
            email: profile.email ?? undefined,
            betaAccess: true, // MVP: 모든 신규 유저 베타 허용
          },
        });
        token.sub = dbUser.id;       // NextAuth sub → DB ID로 덮어씀
        token.nickname = dbUser.displayName;
        token.betaAccess = dbUser.betaAccess;
      }
      return token;
    },
    async session({ session, token }) {
      // session.user에 DB ID와 nickname 주입
      session.user.id = token.sub as string;
      session.user.name = token.nickname as string;
      return session;
    },
  },
  pages: {
    signIn: "/auth", // 커스텀 로그인 페이지
  },
});

export const handlers = nextAuth.handlers;
export const auth = nextAuth.auth;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
