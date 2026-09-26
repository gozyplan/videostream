import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN;

const TELEGRAM_CHAT_ID =
  process.env.TELEGRAM_CHAT_ID;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    if (
      !TELEGRAM_BOT_TOKEN ||
      !TELEGRAM_CHAT_ID
    ) {
      return NextResponse.json(
        {
          error:
            "Telegram environment variables are missing.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const {
      userId,
      telegramUserId,
      inviteLink,
    } = body;

    if (!userId || !telegramUserId) {
      return NextResponse.json(
        {
          error:
            "userId and telegramUserId are required.",
        },
        { status: 400 }
      );
    }

    const { data: existingMembership } =
      await supabaseAdmin
        .from("telegram_memberships")
        .select("id")
        .eq("user_id", userId)
        .eq(
          "telegram_chat_id",
          Number(TELEGRAM_CHAT_ID)
        )
        .maybeSingle();

    if (existingMembership) {
      const { data, error } =
        await supabaseAdmin
          .from("telegram_memberships")
          .update({
            telegram_user_id:
              Number(telegramUserId),
            invite_link:
              inviteLink || null,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", existingMembership.id)
          .select()
          .single();

      if (error) {
        console.error(
          "Telegram membership update error:",
          error
        );

        return NextResponse.json(
          {
            error:
              "Could not update Telegram membership.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        membership: data,
      });
    }

    const { data, error } =
      await supabaseAdmin
        .from("telegram_memberships")
        .insert({
          user_id: userId,
          telegram_user_id:
            Number(telegramUserId),
          telegram_chat_id:
            Number(TELEGRAM_CHAT_ID),
          invite_link:
            inviteLink || null,
          joined_at:
            new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
      console.error(
        "Telegram membership insert error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Could not create Telegram membership.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      membership: data,
    });
  } catch (error) {
    console.error(
      "Create Telegram membership error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Internal server error.",
      },
      { status: 500 }
    );
  }
}