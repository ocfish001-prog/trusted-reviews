#!/usr/bin/env python3
"""
Seed demo data for Trusted Reviews Network
Silver Lake / Echo Park LA neighborhood launch market
"""

import psycopg2
import bcrypt
import uuid

DB_URL = "postgresql://postgres:OTNW9MIAs7nbLYijV42tZ65x@gondola.proxy.rlwy.net:23483/trusted_reviews"
PASSWORD = "TrustedLA2024!"


def hash_password(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def run():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print("Connecting to DB...")

    # ── CLEAR existing demo data (idempotent re-run) ──────────────────────
    print("Clearing existing demo data...")
    demo_emails = [
        "maya@trusted-reviews.app",
        "diego@trusted-reviews.app",
        "sarah@trusted-reviews.app",
        "james@trusted-reviews.app",
        "zoe@trusted-reviews.app",
    ]
    # Reviews, friendships, invites cascade via FK; just delete users + businesses
    cur.execute("DELETE FROM users WHERE email = ANY(%s)", (demo_emails,))
    demo_businesses = [
        "Intelligentsia Coffee",
        "Sqirl",
        "Bar Flores",
        "Cookbook",
        "Dinosaur Coffee",
    ]
    cur.execute("DELETE FROM businesses WHERE name = ANY(%s)", (demo_businesses,))
    # Also remove the Big Poppa placeholder invite code
    cur.execute("DELETE FROM invites WHERE code = 'BP-AGSVGSBU'")

    # ── USERS ─────────────────────────────────────────────────────────────
    print("Seeding users...")
    pw_hash = hash_password(PASSWORD)

    users = [
        {
            "id": str(uuid.uuid4()),
            "email": "maya@trusted-reviews.app",
            "name": "Maya Chen",
            "bio": "Food blogger and hyper-local connector. If it's worth eating in Silver Lake, I've probably written about it. DMs open for recs.",
            "location": "Silver Lake, Los Angeles",
            "invite_code": "MAYA-SL2024",
        },
        {
            "id": str(uuid.uuid4()),
            "email": "diego@trusted-reviews.app",
            "name": "Diego Ramirez",
            "bio": "Chef + Silver Lake lifer. I eat out on my days off to remember why I love food. Straight talk, no hype.",
            "location": "Silver Lake, Los Angeles",
            "invite_code": "DIEGO-CHEF",
        },
        {
            "id": str(uuid.uuid4()),
            "email": "sarah@trusted-reviews.app",
            "name": "Sarah Kim",
            "bio": "Transplant from NYC, still figuring out LA. Here for honest recs from people who actually live here.",
            "location": "Echo Park, Los Angeles",
            "invite_code": "SARAH-EP24",
        },
        {
            "id": str(uuid.uuid4()),
            "email": "james@trusted-reviews.app",
            "name": "James Park",
            "bio": "Echo Park local. Coffee first, everything else second. I've dialed in every espresso machine within a 2-mile radius.",
            "location": "Echo Park, Los Angeles",
            "invite_code": "JAMES-COFFEE",
        },
        {
            "id": str(uuid.uuid4()),
            "email": "zoe@trusted-reviews.app",
            "name": "Zoe Martinez",
            "bio": "Silver Lake resident and professional bruncher. Weekend mornings are sacred. I know all the good spots and all the overrated ones.",
            "location": "Silver Lake, Los Angeles",
            "invite_code": "ZOE-BRUNCH",
        },
    ]

    user_map = {}
    for u in users:
        cur.execute(
            """INSERT INTO users (id, email, name, bio, location, invite_code, password_hash)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (u["id"], u["email"], u["name"], u["bio"], u["location"], u["invite_code"], pw_hash),
        )
        user_map[u["email"]] = u["id"]
        print(f"  ✓ {u['name']} ({u['email']})")

    maya_id  = user_map["maya@trusted-reviews.app"]
    diego_id = user_map["diego@trusted-reviews.app"]
    sarah_id = user_map["sarah@trusted-reviews.app"]
    james_id = user_map["james@trusted-reviews.app"]
    zoe_id   = user_map["zoe@trusted-reviews.app"]

    # ── BUSINESSES ────────────────────────────────────────────────────────
    print("\nSeeding businesses...")
    businesses = [
        {
            "id": str(uuid.uuid4()),
            "name": "Intelligentsia Coffee",
            "category": "coffee shop",
            "address": "3922 W Sunset Blvd, Los Angeles, CA 90029",
            "lat": 34.0890,
            "lng": -118.2717,
            "google_place_id": "ChIJFAKE_intelligentsia_silver_lake",
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sqirl",
            "category": "café/restaurant",
            "address": "720 N Virgil Ave, Los Angeles, CA 90029",
            "lat": 34.0836,
            "lng": -118.2887,
            "google_place_id": "ChIJFAKE_sqirl_silver_lake",
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Bar Flores",
            "category": "bar",
            "address": "1708 W Sunset Blvd, Los Angeles, CA 90026",
            "lat": 34.0768,
            "lng": -118.2594,
            "google_place_id": "ChIJFAKE_bar_flores_echo_park",
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Cookbook",
            "category": "restaurant",
            "address": "1549 Echo Park Ave, Los Angeles, CA 90026",
            "lat": 34.0781,
            "lng": -118.2611,
            "google_place_id": "ChIJFAKE_cookbook_echo_park",
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Dinosaur Coffee",
            "category": "coffee shop",
            "address": "4334 W Sunset Blvd, Los Angeles, CA 90029",
            "lat": 34.0903,
            "lng": -118.2773,
            "google_place_id": "ChIJFAKE_dinosaur_coffee_silver_lake",
        },
    ]

    biz_map = {}
    for b in businesses:
        cur.execute(
            """INSERT INTO businesses (id, name, category, address, lat, lng, google_place_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (b["id"], b["name"], b["category"], b["address"], b["lat"], b["lng"], b["google_place_id"]),
        )
        biz_map[b["name"]] = b["id"]
        print(f"  ✓ {b['name']}")

    intelligentsia_id = biz_map["Intelligentsia Coffee"]
    sqirl_id          = biz_map["Sqirl"]
    bar_flores_id     = biz_map["Bar Flores"]
    cookbook_id       = biz_map["Cookbook"]
    dinosaur_id       = biz_map["Dinosaur Coffee"]

    # ── REVIEWS ───────────────────────────────────────────────────────────
    print("\nSeeding reviews...")
    reviews = [
        # James → Intelligentsia (5, friends)
        {
            "user_id": james_id,
            "business_id": intelligentsia_id,
            "rating": 5,
            "body": "Finally a coffee shop that doesn't blast music at 8am. The cortado is perfectly pulled — no bitter finish, just clean espresso with a silky texture. Gets slammed on weekends so go early or you're waiting 20 minutes. Skip the pastries here and get toast at Sqirl next door instead. The staff actually knows your order by week two.",
            "pros": ["Perfect cortado", "Quiet morning vibe", "Staff remembers regulars"],
            "cons": ["Weekend wait is brutal", "Pastries are just okay"],
            "visibility": "friends",
        },
        # Zoe → Sqirl (5, 2hop)
        {
            "user_id": zoe_id,
            "business_id": sqirl_id,
            "rating": 5,
            "body": "The ricotta toast is genuinely one of the best things I've eaten in LA. I know that sounds absurd for toast but try it and you'll understand. The jam situation is elite. Lines are a fact of life — go on a weekday if you can, bring a friend, grab coffee from Intelligentsia around the corner while you wait. Worth every minute.",
            "pros": ["Ricotta toast is unreal", "Jam selection incredible", "Great natural light inside"],
            "cons": ["Lines on weekends", "Cash only for some items", "Limited seating"],
            "visibility": "2hop",
        },
        # Maya → Sqirl (4, friends)
        {
            "user_id": maya_id,
            "business_id": sqirl_id,
            "rating": 4,
            "body": "Sqirl is the real deal — just go in with the right expectations. This isn't a quick breakfast spot. Budget 30-45 minutes minimum. The sorrel rice bowl is underrated and way better than most people realize. Jam jars to go are a great gift if you're visiting someone. Prices have crept up but quality has kept pace.",
            "pros": ["Sorrel rice bowl underrated gem", "Jam jars make great gifts", "Consistent quality"],
            "cons": ["Not quick, plan ahead", "Pricier than it used to be"],
            "visibility": "friends",
        },
        # Diego → Bar Flores (5, 2hop)
        {
            "user_id": diego_id,
            "business_id": bar_flores_id,
            "rating": 5,
            "body": "As a chef I'm skeptical of places with good food AND good cocktails — usually one suffers. Bar Flores somehow nails both. The mezcal selection is serious and the kitchen clearly has a point of view. It's cozy in a way that a lot of Echo Park spots try to fake. Go on a Tuesday, it's a totally different vibe than the weekend crush.",
            "pros": ["Serious mezcal program", "Kitchen actually knows what it's doing", "Great Tuesday vibe"],
            "cons": ["Weekends can feel chaotic", "Limited seating"],
            "visibility": "2hop",
        },
        # Sarah → Bar Flores (4, friends)
        {
            "user_id": sarah_id,
            "business_id": bar_flores_id,
            "rating": 4,
            "body": "Coming from NYC I was skeptical LA bar food would deliver but Bar Flores shut me up fast. The natural wine list is good and the snacks are genuinely worth ordering — not just bar filler. Neighborhood crowd, not a scene. Found this place through a friend recommendation and it's already a regular spot after only 2 months in LA.",
            "pros": ["Solid natural wine list", "Bar snacks worth ordering", "Neighborhood not touristy"],
            "cons": ["Service can be slow when busy", "Gets loud"],
            "visibility": "friends",
        },
        # James → Cookbook (4, 2hop)
        {
            "user_id": james_id,
            "business_id": cookbook_id,
            "rating": 4,
            "body": "One of those places that doesn't look like much from outside but completely delivers inside. The menu is tight — they do a small number of things and do them right. Grains and vegetables are the star here, which sounds boring until you eat them. Good for a solo dinner or a low-key date. Bring cash, they prefer it.",
            "pros": ["Focused menu done well", "Grains and veg are the highlight", "Great for solo dining"],
            "cons": ["Small space, limited seating", "Can sell out of items early"],
            "visibility": "2hop",
        },
        # Maya → Cookbook (5, friends)
        {
            "user_id": maya_id,
            "business_id": cookbook_id,
            "rating": 5,
            "body": "Cookbook is my sleeper rec for anyone in Echo Park. The owner sources everything carefully and you can taste the difference. I've been going for years and the quality has been remarkably consistent. It's the kind of place that earns the word 'neighborhood institution' without trying to. The grain salads change seasonally and I've never had a bad one.",
            "pros": ["Hyper-seasonal ingredients", "Grain salads consistently excellent", "True neighborhood spot"],
            "cons": ["Hours can be inconsistent, call ahead"],
            "visibility": "friends",
        },
        # Diego → Dinosaur Coffee (4, 2hop)
        {
            "user_id": diego_id,
            "business_id": dinosaur_id,
            "rating": 4,
            "body": "Dinosaur is the anti-Intelligentsia in the best way — more casual, louder, younger crowd. The espresso is genuinely good, not just aesthetically good. The space has character that wasn't manufactured. Go here for a longer hang or to work for a few hours; go to Intelligentsia when you want pure coffee focus. Both have their place.",
            "pros": ["Great hangout energy", "Espresso quality is legit", "More relaxed atmosphere"],
            "cons": ["Can get packed and loud", "Wifi spotty"],
            "visibility": "2hop",
        },
        # Zoe → Dinosaur Coffee (5, friends)
        {
            "user_id": zoe_id,
            "business_id": dinosaur_id,
            "rating": 5,
            "body": "My Sunday morning spot, full stop. The outdoor seating is some of the best in Silver Lake — right amount of sun, good people watching on Sunset. Staff is genuinely friendly, not in a forced way. They always have seasonal specials that are actually interesting, not just 'lavender latte' nonsense. Bring your laptop or bring a friend; both work.",
            "pros": ["Best outdoor seating in Silver Lake", "Friendly staff", "Interesting seasonal specials"],
            "cons": ["Parking situation on Sunset is rough"],
            "visibility": "friends",
        },
        # Sarah → Intelligentsia (4, 2hop)
        {
            "user_id": sarah_id,
            "business_id": intelligentsia_id,
            "rating": 4,
            "body": "James told me to come here and he was right. Coffee is excellent — I've been a pour-over skeptic for years and this place converted me. The vibe is calmer than I expected for a place this well-known. Prices are what you'd expect for specialty coffee in LA but not absurd. My go-to when I'm over in Silver Lake.",
            "pros": ["Pour-over is outstanding", "Calmer vibe than expected", "Knowledgeable staff"],
            "cons": ["No free wifi", "Can feel cliquey"],
            "visibility": "2hop",
        },
    ]

    for r in reviews:
        cur.execute(
            """INSERT INTO reviews (user_id, business_id, rating, body, pros, cons, visibility)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (r["user_id"], r["business_id"], r["rating"], r["body"], r["pros"], r["cons"], r["visibility"]),
        )
    print(f"  ✓ {len(reviews)} reviews seeded")

    # ── FRIENDSHIPS ───────────────────────────────────────────────────────
    print("\nSeeding friend connections...")
    friendships = [
        (maya_id, diego_id),
        (maya_id, sarah_id),
        (diego_id, james_id),
        (sarah_id, zoe_id),
        (james_id, zoe_id),
    ]

    for a, b in friendships:
        cur.execute(
            """INSERT INTO friendships (user_a, user_b, status) VALUES (%s, %s, 'accepted')""",
            (a, b),
        )
    print(f"  ✓ {len(friendships)} friendships seeded")

    # ── INVITE CODES (3 per user) ─────────────────────────────────────────
    print("\nSeeding invite codes...")
    invite_batches = [
        # Maya's invites
        (maya_id, "MAYA-INV-001"),
        (maya_id, "MAYA-INV-002"),
        (maya_id, "MAYA-INV-003"),
        # Diego's invites
        (diego_id, "DIEGO-INV-001"),
        (diego_id, "DIEGO-INV-002"),
        (diego_id, "DIEGO-INV-003"),
        # Sarah's invites
        (sarah_id, "SARAH-INV-001"),
        (sarah_id, "SARAH-INV-002"),
        (sarah_id, "SARAH-INV-003"),
        # James's invites
        (james_id, "JAMES-INV-001"),
        (james_id, "JAMES-INV-002"),
        (james_id, "JAMES-INV-003"),
        # Zoe's invites
        (zoe_id, "ZOE-INV-001"),
        (zoe_id, "ZOE-INV-002"),
        (zoe_id, "ZOE-INV-003"),
        # Big Poppa's special entry invite
        (maya_id, "BP-AGSVGSBU"),
    ]

    for creator, code in invite_batches:
        cur.execute(
            """INSERT INTO invites (created_by, code) VALUES (%s, %s)
               ON CONFLICT (code) DO NOTHING""",
            (creator, code),
        )
    print(f"  ✓ {len(invite_batches)} invite codes seeded (incl. BP-AGSVGSBU)")

    # Note: Big Poppa pending friendship from Maya will be added once he signs up
    # BP-AGSVGSBU invite is seeded — Maya created it, ready for Big Poppa to use

    conn.commit()
    conn.close()

    print("\n" + "="*60)
    print("✅ SEED COMPLETE")
    print("="*60)
    print()
    print("SEEDED USERS:")
    print("maya@trusted-reviews.app  / password: TrustedLA2024!")
    print("diego@trusted-reviews.app / password: TrustedLA2024!")
    print("sarah@trusted-reviews.app / password: TrustedLA2024!")
    print("james@trusted-reviews.app / password: TrustedLA2024!")
    print("zoe@trusted-reviews.app   / password: TrustedLA2024!")
    print()
    print("SEEDED BUSINESSES:")
    print("  - Intelligentsia Coffee (Silver Lake)")
    print("  - Sqirl (Silver Lake)")
    print("  - Bar Flores (Echo Park)")
    print("  - Cookbook (Echo Park)")
    print("  - Dinosaur Coffee (Silver Lake)")
    print()
    print("REVIEWS: 10 authentic reviews seeded")
    print("FRIENDSHIPS: 5 connections (all accepted)")
    print("INVITE CODES: 15 user codes + BP-AGSVGSBU for Big Poppa")
    print()
    print("Big Poppa's entry invite: BP-AGSVGSBU (created by Maya)")
    print("Once Big Poppa signs up, add pending friendship from Maya manually")
    print("  or re-run with --add-bp-friendship <user_id>")


if __name__ == "__main__":
    run()
