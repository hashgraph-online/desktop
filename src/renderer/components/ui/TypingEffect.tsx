import React, { useState, useEffect, useRef } from 'react'

interface TypingEffectProps {
  texts: string[]
  typingSpeed?: number
  deletingSpeed?: number
  delayBetweenTexts?: number
  className?: string
}

/**
 * A component that creates a typing animation effect
 */
const TypingEffect: React.FC<TypingEffectProps> = ({
  texts,
  typingSpeed = 50,
  deletingSpeed = 30,
  delayBetweenTexts = 2000,
  className = ''
}) => {
  const [displayedText, setDisplayedText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [textIndex, setTextIndex] = useState(0)
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current)
    }
  }, [texts])

  useEffect(() => {
    const currentText = texts[textIndex]

    if (!isDeleting && displayedText.length < currentText.length) {
      typingTimeoutRef.current = setTimeout(() => {
        setDisplayedText(currentText.substring(0, displayedText.length + 1))
      }, typingSpeed)
    } else if (!isDeleting && displayedText.length === currentText.length) {
      pauseTimeoutRef.current = setTimeout(() => {
        setIsDeleting(true)
      }, delayBetweenTexts)
    } else if (isDeleting && displayedText.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        setDisplayedText(displayedText.substring(0, displayedText.length - 1))
      }, deletingSpeed)
    } else if (isDeleting && displayedText.length === 0) {
      setIsDeleting(false)
      setTextIndex((textIndex + 1) % texts.length)
    }
  }, [
    displayedText,
    isDeleting,
    textIndex,
    texts,
    typingSpeed,
    deletingSpeed,
    delayBetweenTexts,
  ])

  return (
    <span className={className}>
      {displayedText}
      <span className="inline-block w-0.5 h-5 ml-0.5 bg-[#5599fe] animate-pulse" />
    </span>
  )
}

export default TypingEffect