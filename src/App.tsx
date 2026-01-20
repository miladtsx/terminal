import { useState } from "react";
import Terminal from "@components/terminal";
import BookingOverlay from "@components/BookingOverlay";

const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL || "miladtsx+terminal@gmail.com";

export default function App() {
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <>
      <Terminal
        contact={{
          email: CONTACT_EMAIL,
        }}
        onBookCall={() => setBookingOpen(true)}
      />

      <BookingOverlay
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        email={CONTACT_EMAIL}
      />
    </>
  );
}
