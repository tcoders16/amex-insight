"use client"

import { useState } from "react"

const SKILLS = [
  "Digital Marketing & Social Media Strategy",
  "Content Creation & Video Editing",
  "Campaign Planning & Execution",
  "Consumer Behaviour & Market Analysis",
  "Brand Management & Storytelling",
  "Client Relationship Management",
  "Retail Operations & Customer Experience",
  "Excellent Written & Verbal Communication",
  "Strong Organisational & Time Management",
  "Team Collaboration & Independent Initiative",
]

const EXPERIENCE = [
  {
    title: "Marketing & Social Media Intern",
    company: "Clip Hair Salon",
    location: "Toronto",
    period: "September 2024 – December 2024",
    bullets: [
      "Developed and executed a comprehensive social media content strategy across Instagram and TikTok, increasing brand visibility and driving measurable follower growth.",
      "Produced and edited high-quality photo and video assets showcasing salon services, seasonal promotions, and industry trends, maintaining consistent brand aesthetics.",
      "Planned and delivered targeted digital campaigns for salon events and product launches, aligning content with broader marketing objectives.",
      "Monitored and analysed social media performance metrics—including reach, engagement rate, and impressions—to refine content strategy and optimise posting cadence.",
      "Cultivated an active online community by responding promptly to comments and direct messages, strengthening client trust and brand loyalty.",
    ],
  },
  {
    title: "Store Associate",
    company: "Kernels & Yogen Fruz",
    location: "Toronto",
    period: "November 2023 – Present",
    bullets: [
      "Delivered consistently outstanding customer service within a fast-paced, high-volume retail environment, ensuring a professional and welcoming experience for all clientele.",
      "Managed cash handling, point-of-sale transactions, and daily opening and closing procedures with precision and accountability.",
      "Operated specialised equipment and upheld rigorous food safety and sanitation standards in full compliance with applicable health regulations.",
      "Collaborated proactively with team members to sustain smooth store operations, uphold service standards, and support broader operational goals.",
    ],
  },
]

const EDUCATION = [
  {
    degree: "Diploma in Business – Marketing",
    school: "Humber Polytechnic",
    location: "Toronto, Ontario",
    period: "2023 – 2024",
  },
  {
    degree: "High School Diploma – Accounting & Business Studies",
    school: "SGN Public School",
    location: "",
    period: "2020 – 2022",
  },
]

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-bold tracking-widest text-navy uppercase mb-1">
        {children}
      </h2>
      <div className="h-px bg-gradient-to-r from-navy via-navy/40 to-transparent" />
    </div>
  )
}

export default function ResumePage() {
  const [downloaded, setDownloaded] = useState(false)

  function handleDownload() {
    const link = document.createElement("a")
    link.href = "/Arshdeep_Kaur_Resume.docx"
    link.download = "Arshdeep_Kaur_Resume.docx"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <style>{`
        .text-navy { color: #1F3864; }
        .bg-navy { background-color: #1F3864; }
        .border-navy { border-color: #1F3864; }
        .from-navy { --tw-gradient-from: #1F3864; }
      `}</style>

      {/* Download bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 font-medium">Resume Preview</p>
          <p className="text-xs text-slate-400">Arshdeep Kaur — Marketing Professional</p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
          style={{ background: downloaded ? "#16a34a" : "#1F3864" }}
        >
          {downloaded ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Downloaded!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download .docx
            </>
          )}
        </button>
      </div>

      {/* Resume card */}
      <div
        className="max-w-4xl mx-auto bg-white shadow-xl"
        style={{ fontFamily: "'Times New Roman', Times, serif", padding: "56px 64px" }}
      >
        {/* Header */}
        <div className="text-center mb-1">
          <h1
            className="font-bold tracking-widest text-navy mb-1"
            style={{ fontSize: "28px", letterSpacing: "0.15em" }}
          >
            ARSHDEEP KAUR
          </h1>
          <p className="text-slate-500 italic text-sm mb-3">
            Marketing Professional&nbsp;&nbsp;|&nbsp;&nbsp;Brand &amp; Digital Strategy&nbsp;&nbsp;|&nbsp;&nbsp;Content Creation
          </p>
          <div className="border-t-2 border-b border-navy pt-1.5 pb-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm text-slate-700">
            <span>+1 (437) 669-3108</span>
            <span className="text-navy font-bold">·</span>
            <span>Arshk1985@gmail.com</span>
            <span className="text-navy font-bold">·</span>
            <span>Toronto, Ontario</span>
            <span className="text-navy font-bold">·</span>
            <span className="italic text-slate-500">linkedin.com/in/arshdeep-kaur</span>
          </div>
        </div>

        <div className="mt-6">
          {/* Summary */}
          <SectionHeading>Professional Summary</SectionHeading>
          <p className="text-sm text-slate-800 leading-relaxed mb-6" style={{ textAlign: "justify" }}>
            A results-oriented Marketing professional holding a Diploma in Business–Marketing from Humber
            Polytechnic, with demonstrated expertise in digital content strategy, brand management, and
            consumer engagement across social media platforms. Adept at developing and executing
            data-informed campaigns that elevate brand visibility, foster audience growth, and translate
            creative vision into measurable business outcomes. Known for combining strong analytical
            capabilities with a client-centric approach to build lasting relationships and contribute
            meaningfully to high-performance, innovation-driven marketing teams.
          </p>

          {/* Experience */}
          <SectionHeading>Professional Experience</SectionHeading>
          <div className="mb-6 space-y-5">
            {EXPERIENCE.map((exp) => (
              <div key={exp.title}>
                <div className="flex items-baseline justify-between flex-wrap gap-1 mb-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm text-slate-900">{exp.title}</span>
                    <span className="text-slate-400 text-xs">|</span>
                    <span className="italic text-xs text-slate-500">{exp.company}, {exp.location}</span>
                  </div>
                  <span className="text-xs text-slate-400">{exp.period}</span>
                </div>
                <ul className="space-y-1 mt-1.5">
                  {exp.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
                      <span className="text-navy mt-0.5 flex-shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Education */}
          <SectionHeading>Education</SectionHeading>
          <div className="mb-6 space-y-3">
            {EDUCATION.map((edu) => (
              <div key={edu.degree} className="flex items-start justify-between flex-wrap gap-1">
                <div>
                  <p className="font-bold text-sm text-slate-900">{edu.degree}</p>
                  <p className="italic text-xs text-slate-500">
                    {edu.school}{edu.location ? `, ${edu.location}` : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-400 mt-0.5">{edu.period}</span>
              </div>
            ))}
          </div>

          {/* Skills */}
          <SectionHeading>Core Competencies</SectionHeading>
          <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1.5">
            {SKILLS.map((s) => (
              <div key={s} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-navy flex-shrink-0 mt-0.5">•</span>
                <span>{s}</span>
              </div>
            ))}
          </div>

          {/* Certifications */}
          <SectionHeading>Certifications &amp; Availability</SectionHeading>
          <div className="flex flex-wrap gap-x-12 gap-y-1 text-sm text-slate-700">
            <p>
              <span className="font-bold text-slate-900">Certification: </span>
              Food Handler Certification
            </p>
            <p>
              <span className="font-bold text-slate-900">Availability: </span>
              Full-Time | Monday – Sunday
            </p>
          </div>
        </div>

        {/* Footer rule */}
        <div className="mt-8 border-t border-navy/30 pt-3 text-center">
          <p className="text-xs italic text-slate-400">References available upon request</p>
        </div>
      </div>

      {/* Second download button at bottom */}
      <div className="max-w-4xl mx-auto mt-6 flex justify-center">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
          style={{ background: downloaded ? "#16a34a" : "#1F3864" }}
        >
          {downloaded ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Downloaded!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Resume (.docx)
            </>
          )}
        </button>
      </div>
    </div>
  )
}
